package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
)

// PositionPoint is one sampled hero snapshot. X/Y are in the same ~64-192
// world-grid cell scale OpenDota's obs_log/deaths_pos already use, so the
// frontend can feed these straight into the existing minimap interpolation
// without any unit conversion. Level, health, and mana ride along so the
// playback UI can render live bars.
type PositionPoint struct {
	T     float64 `json:"t"` // match clock, seconds
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Level int32   `json:"lvl"`
	HP    int32   `json:"hp"`
	MaxHP int32   `json:"mhp"`
	MP    int32   `json:"mp"`
	MaxMP int32   `json:"mmp"`
}

// KillEvent is one hero death from the combat log, with the detail OpenDota
// never exposes: the killing-blow ability/item and the victim's death gold
// loss. Names are raw combat-log names (npc_dota_hero_*, ability/item
// names); the frontend maps them to display names.
type KillEvent struct {
	T         float64 `json:"t"` // match clock, seconds (negative = pre-horn)
	Attacker  string  `json:"attacker"`
	Victim    string  `json:"victim"`
	Inflictor string  `json:"inflictor,omitempty"` // absent = plain attack
	GoldLost  int32   `json:"gold,omitempty"`
}

// Dota 2 Source 2 replays tick at a fixed 30Hz. This is a stable, widely
// relied-upon community constant (clarity/manta-based tools all assume it),
// not something the demo header exposes directly.
const tickRate = 30.0

// ExtractMatch parses a decompressed .dem stream and returns a ParsedMatch:
// one position series per player_slot (0-4 Radiant, 128-132 Dire) sampled at
// roughly 1Hz, kill events with combat-log detail, and the match duration
// in seconds.
func ExtractMatch(matchID int64, dem io.Reader) (*ParsedMatch, error) {
	p, err := manta.NewStreamParser(dem)
	if err != nil {
		return nil, fmt.Errorf("create parser: %w", err)
	}

	players := map[string]*PlayerParsed{}
	for _, slot := range []int{0, 1, 2, 3, 4, 128, 129, 130, 131, 132} {
		players[fmtSlot(slot)] = &PlayerParsed{}
	}
	heroNameToSlot := map[string]int{}
	_ = heroNameToSlot // populated/consumed by later tasks in this plan

	// DOTA_GAMERULES_STATE_GAME_IN_PROGRESS / _POST_GAME. Position samples
	// only make sense strictly between these two: before 5 the match clock
	// isn't running yet, and heroes keep sending updates through the
	// post-game scoreboard screen (states 6-7) well past when the match
	// actually ended, which would otherwise inflate the derived duration
	// past OpenDota's own (confirmed empirically: without this gate, the
	// derived duration overshot OpenDota's by ~2.5 minutes of post-game
	// lobby time).
	const stateGameInProgress = 5
	const statePostGame = 6

	var gameStartTime float64 // demo-clock seconds when the match clock hits 0:00
	var gameStartSet bool
	var gameEndTime float64 // demo-clock seconds when the match actually ended
	var gameEndSet bool
	lastEmittedSecond := map[int]int{}
	positions := map[int][]PositionPoint{}

	// Combat-log kills buffer raw timestamps (same clock as
	// m_flGameStartTime) and convert to match time after the parse, since
	// pre-horn kills arrive before the start time is known.
	type rawKill struct {
		ts                          float64
		attacker, victim, inflictor string
	}
	var rawKills []rawKill
	goldLost := map[string]int32{} // "ts|victim" -> death gold loss

	clName := func(idx uint32) string {
		s, _ := p.LookupStringByIndex("CombatLogNames", int32(idx))
		return s
	}
	p.Callbacks.OnCMsgDOTACombatLogEntry(func(m *dota.CMsgDOTACombatLogEntry) error {
		switch m.GetType() {
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_DEATH:
			if !m.GetIsTargetHero() || m.GetIsTargetIllusion() {
				return nil
			}
			rawKills = append(rawKills, rawKill{
				ts:        float64(m.GetTimestamp()),
				attacker:  clName(m.GetAttackerName()),
				victim:    clName(m.GetTargetName()),
				inflictor: clName(m.GetInflictorName()),
			})
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_GOLD:
			// Reason 1 = death loss; the value is a wrapped negative.
			if m.GetGoldReason() != 1 {
				return nil
			}
			key := fmt.Sprintf("%.1f|%s", m.GetTimestamp(), clName(m.GetTargetName()))
			if v := int32(m.GetValue()); v < 0 {
				goldLost[key] = -v
			}
		}
		return nil
	})

	p.OnEntity(func(e *manta.Entity, op manta.EntityOp) error {
		name := e.GetClassName()

		if name == "CDOTAGamerulesProxy" {
			if state, ok := e.Get("m_pGameRules.m_nGameState").(int32); ok {
				switch {
				case state >= stateGameInProgress && !gameStartSet:
					if v, ok := e.Get("m_pGameRules.m_flGameStartTime").(float32); ok && v > 0 {
						gameStartTime = float64(v)
						gameStartSet = true
					}
				case state >= statePostGame && !gameEndSet:
					gameEndSet = true
					gameEndTime = float64(p.NetTick) / tickRate
				}
			}
		}

		if !strings.HasPrefix(name, "CDOTA_Unit_Hero_") || !op.Flag(manta.EntityOpUpdated) {
			return nil
		}
		if !gameStartSet || gameEndSet {
			return nil // clock not running yet, or match already over
		}

		playerID, ok := e.Get("m_iPlayerID").(uint32)
		if !ok {
			return nil
		}
		teamNum, ok := e.Get("m_iTeamNum").(uint64)
		if !ok {
			return nil
		}
		slot, ok := playerSlot(playerID, teamNum)
		if !ok {
			return nil
		}

		matchTime := float64(p.NetTick)/tickRate - gameStartTime
		if matchTime < 0 {
			return nil
		}
		second := int(matchTime)
		if lastEmittedSecond[slot] == second && len(positions[slot]) > 0 {
			return nil // already have a sample for this second
		}

		x, xok := cellPosition(e, "CBodyComponent.m_cellX", "CBodyComponent.m_vecX")
		y, yok := cellPosition(e, "CBodyComponent.m_cellY", "CBodyComponent.m_vecY")
		if !xok || !yok {
			return nil
		}

		lastEmittedSecond[slot] = second

		pt := PositionPoint{T: matchTime, X: x, Y: y}
		if v, ok := e.Get("m_iCurrentLevel").(int32); ok {
			pt.Level = v
		}
		if v, ok := e.Get("m_iHealth").(int32); ok {
			pt.HP = v
		}
		if v, ok := e.Get("m_iMaxHealth").(int32); ok {
			pt.MaxHP = v
		}
		if v, ok := e.Get("m_flMana").(float32); ok {
			pt.MP = int32(v)
		}
		if v, ok := e.Get("m_flMaxMana").(float32); ok {
			pt.MaxMP = int32(v)
		}
		positions[slot] = append(positions[slot], pt)
		players[fmtSlot(slot)].Positions = append(players[fmtSlot(slot)].Positions, pt)
		return nil
	})

	if err := p.Start(); err != nil {
		// manta returns an error at end-of-stream for most replays; only
		// treat it as fatal if we extracted nothing at all.
		if len(positions) == 0 {
			return nil, fmt.Errorf("parse: %w", err)
		}
	}

	duration := gameEndTime - gameStartTime
	if duration <= 0 {
		// Match never reached post-game in this stream (e.g. truncated
		// replay), fall back to the last sample we actually saw.
		for _, pts := range positions {
			if len(pts) > 0 && pts[len(pts)-1].T > duration {
				duration = pts[len(pts)-1].T
			}
		}
	}

	kills := make([]KillEvent, 0, len(rawKills))
	for _, rk := range rawKills {
		ev := KillEvent{
			T:        rk.ts - gameStartTime,
			Attacker: rk.attacker,
			Victim:   rk.victim,
			GoldLost: goldLost[fmt.Sprintf("%.1f|%s", rk.ts, rk.victim)],
		}
		if rk.inflictor != "" && rk.inflictor != "dota_unknown" {
			ev.Inflictor = rk.inflictor
		}
		kills = append(kills, ev)
	}

	pm := &ParsedMatch{
		MatchID:  matchID,
		Duration: duration,
		Players:  players,
		Kills:    kills,
	}
	return pm, nil
}

// fmtSlot renders a player_slot (0-4 Radiant, 128-132 Dire) as the string
// key used by ParsedMatch.Players and every other per-player map in this
// package.
func fmtSlot(slot int) string { return fmt.Sprintf("%d", slot) }

// playerSlot maps manta's raw m_iPlayerID/m_iTeamNum pair to Dota's familiar
// player_slot convention (0-4 Radiant, 128-132 Dire). Empirically confirmed
// against a real replay: m_iPlayerID runs 0,2,4,6,8 for the five Radiant
// players (team 2) and 10,12,14,16,18 for the five Dire players (team 3).
func playerSlot(playerID uint32, teamNum uint64) (int, bool) {
	switch teamNum {
	case 2: // Radiant
		slot := int(playerID) / 2
		if slot < 0 || slot > 4 {
			return 0, false
		}
		return slot, true
	case 3: // Dire
		slot := (int(playerID) - 10) / 2
		if slot < 0 || slot > 4 {
			return 0, false
		}
		return 128 + slot, true
	default:
		return 0, false
	}
}

// cellPosition combines a coarse integer grid cell with its fine sub-cell
// offset into one precise coordinate, still expressed in cell units so it
// matches OpenDota's existing ~64-192 grid.
func cellPosition(e *manta.Entity, cellField, vecField string) (float64, bool) {
	var cell float64
	switch v := e.Get(cellField).(type) {
	case uint32:
		cell = float64(v)
	case int32:
		cell = float64(v)
	case uint64:
		cell = float64(v)
	default:
		return 0, false
	}
	vec, ok := e.Get(vecField).(float32)
	if !ok {
		return 0, false
	}
	return cell + float64(vec)/256.0, true
}
