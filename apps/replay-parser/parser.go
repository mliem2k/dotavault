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

	// xpBySlot tracks each hero's highest known m_iCurrentXP, fed by the
	// hero OnEntity callback below and consumed by sampleTeamData's
	// per-minute sampling further down (XP lives on the hero unit itself,
	// not on CDOTA_DataRadiant/CDOTA_DataDire — see FIELD_NOTES.md). It
	// latches the running maximum rather than overwriting on every
	// update because some heroes (Monkey King, Arc Warden — confirmed
	// empirically in this fixture while verifying Task 6's slot
	// alignment, see FIELD_NOTES.md's "Entity contamination" section)
	// have multiple entities sharing their exact class name, m_iPlayerID,
	// and m_iTeamNum: one real hero plus one or more decoys that always
	// read m_iCurrentXP=0. XP is never-decreasing in Dota, so latching
	// the max is immune to those always-zero decoys without needing any
	// per-entity identity tracking — verified to reproduce
	// CDOTA_DataRadiant/CDOTA_DataDire's independently-tracked
	// m_iTotalEarnedXP exactly, for all 10 heroes in this fixture.
	xpBySlot := map[string]int32{}
	lastSampledMinute := map[string]int{}
	for _, slot := range []int{0, 1, 2, 3, 4, 128, 129, 130, 131, 132} {
		lastSampledMinute[fmtSlot(slot)] = -1
	}

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

	// heroPositions tracks each hero's latest known position, updated as a
	// side effect of the hero OnEntity callback below. The ward OnEntity
	// callback further down reads this to resolve which hero placed a given
	// ward by spatial proximity (see wards.go's wardOwnerSlot) — wards have
	// no live owner field to read directly once placed. This sits
	// downstream of Task 100's decoy/clone rejection gate in the hero
	// callback (the xpBySlot latch-and-reject logic), so it only ever
	// reflects the real hero entity, never a Primal Split/Tempest Double
	// decoy.
	heroPositions := map[int][2]float64{}

	// Combat-log kills buffer raw timestamps (same clock as
	// m_flGameStartTime) and convert to match time after the parse, since
	// pre-horn kills arrive before the start time is known.
	type rawKill struct {
		ts                          float64
		attacker, victim, inflictor string
	}
	var rawKills []rawKill
	goldLost := map[string]int32{} // "ts|victim" -> death gold loss
	var objectives []ObjectiveEvent

	clName := func(idx uint32) string {
		s, _ := p.LookupStringByIndex("CombatLogNames", int32(idx))
		return s
	}
	p.Callbacks.OnCMsgDOTACombatLogEntry(func(m *dota.CMsgDOTACombatLogEntry) error {
		switch m.GetType() {
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_DEATH:
			if !m.GetIsTargetHero() || m.GetIsTargetIllusion() {
				handleNonHeroDeath(players, heroNameToSlot, clName(m.GetAttackerName()), clName(m.GetTargetName()), m.GetIsTargetBuilding())
				return nil
			}
			rawKills = append(rawKills, rawKill{
				ts:        float64(m.GetTimestamp()),
				attacker:  clName(m.GetAttackerName()),
				victim:    clName(m.GetTargetName()),
				inflictor: clName(m.GetInflictorName()),
			})
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_DAMAGE:
			handleDamage(players, heroNameToSlot, clName(m.GetAttackerName()), clName(m.GetTargetName()), clName(m.GetInflictorName()), int32(m.GetValue()))
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_GOLD:
			handleGoldReason(players, heroNameToSlot, clName(m.GetTargetName()), m.GetGoldReason(), int32(m.GetValue()))
			// Reason 1 = death loss; the value is a wrapped negative. This
			// existing death-gold-loss handling stays as-is; the call above
			// generalizes gold_reasons tracking to every reason, not just 1.
			if m.GetGoldReason() != 1 {
				return nil
			}
			key := fmt.Sprintf("%.1f|%s", m.GetTimestamp(), clName(m.GetTargetName()))
			if v := int32(m.GetValue()); v < 0 {
				goldLost[key] = -v
			}
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_XP:
			handleXpReason(players, heroNameToSlot, clName(m.GetTargetName()), m.GetXpReason(), int32(m.GetValue()))
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_PURCHASE:
			handlePurchase(players, heroNameToSlot, clName(m.GetTargetName()), clName(m.GetValue()), matchTimeOf(m, gameStartTime))
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_PICKUP_RUNE:
			handleRunePickup(players, heroNameToSlot, clName(m.GetAttackerName()), m.GetRuneType(), matchTimeOf(m, gameStartTime))
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_ABILITY:
			tallyAbilityOrItemUse(players, heroNameToSlot, clName(m.GetAttackerName()), clName(m.GetInflictorName()), false)
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_ITEM:
			tallyAbilityOrItemUse(players, heroNameToSlot, clName(m.GetAttackerName()), clName(m.GetInflictorName()), true)
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_MULTIKILL:
			tallyMultiKill(players, heroNameToSlot, clName(m.GetAttackerName()), m.GetValue())
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_KILLSTREAK:
			tallyKillStreak(players, heroNameToSlot, clName(m.GetAttackerName()), m.GetValue())
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_NEUTRAL_CAMP_STACK:
			tallyCampStack(players, heroNameToSlot, clName(m.GetAttackerName()))
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_FIRST_BLOOD:
			// No attacker/target identity on this entry (see firstBloodSlot's
			// comment) — record only what's real: time and team, no fabricated Key.
			objectives = append(objectives, ObjectiveEvent{T: matchTimeOf(m, gameStartTime), Type: "CHAT_MESSAGE_FIRSTBLOOD", Team: int32Ptr(int32(m.GetAttackerTeam()))})
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_TEAM_BUILDING_KILL:
			objectives = append(objectives, ObjectiveEvent{T: matchTimeOf(m, gameStartTime), Type: "building_kill", Key: strPtr(clName(m.GetTargetName())), Team: int32Ptr(int32(m.GetTargetTeam()))})
		case dota.DOTA_COMBATLOG_TYPES_DOTA_COMBATLOG_AEGIS_TAKEN:
			objectives = append(objectives, ObjectiveEvent{T: matchTimeOf(m, gameStartTime), Type: "CHAT_MESSAGE_AEGIS", Key: strPtr(clName(m.GetAttackerName()))})
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
		// xpBySlot is latched (fresh, every valid update, max-wins — see
		// xpBySlot's doc comment above) regardless of the per-second
		// position dedup below — XP lives on this same hero entity (see
		// FIELD_NOTES.md's XP section) but has no reason to be coupled to
		// position-field availability or the 1Hz position sampling rate.
		key := fmtSlot(slot)
		xp, hasXP := e.GetInt32("m_iCurrentXP")
		if hasXP && xp > xpBySlot[key] {
			xpBySlot[key] = xp
		}
		if hasXP && xp < xpBySlot[key] {
			// This entity has fallen behind the highest-ever-seen XP for this
			// slot. For heroes with clone/split mechanics (Monkey King, Arc
			// Warden — see FIELD_NOTES.md's "Entity contamination" section),
			// that means it's a dormant decoy sharing the real hero's exact
			// class/player/team, not the real hero body — XP never decreases,
			// so only the real hero can hold the current max. Reject this
			// entity's data outright (heroNameToSlot resolution, position,
			// level, HP, mana) rather than let it race the real entity for
			// "whichever fires first this second."
			return nil
		}
		// The naive "strip CDOTA_Unit_Hero_ prefix + lowercase" transform
		// (e.g. CDOTA_Unit_Hero_Axe -> npc_dota_hero_axe) breaks for
		// multi-word hero names, and Dota's internal names are
		// inconsistently underscored (verified in this fixture:
		// CDOTA_Unit_Hero_ArcWarden's real combat-log name is
		// npc_dota_hero_arc_warden, CDOTA_Unit_Hero_MonkeyKing's is
		// npc_dota_hero_monkey_king, CDOTA_Unit_Hero_LoneDruid's is
		// npc_dota_hero_lone_druid — no simple string transform derives
		// these correctly from the class name alone). The entity's
		// m_pEntity.m_nameStringTableIndex, resolved through the
		// "EntityNames" string table, is the same ground-truth internal
		// name manta already resolves combat log attacker/target names
		// against, so use that directly instead of reconstructing it.
		if idx, ok := e.Get("m_pEntity.m_nameStringTableIndex").(int32); ok {
			if realName, ok := p.LookupStringByIndex("EntityNames", idx); ok {
				heroNameToSlot[realName] = slot
			}
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
		heroPositions[slot] = [2]float64{x, y}

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
		recordLanePosSample(players[fmtSlot(slot)], x, y, matchTime)
		return nil
	})

	// Observer ward lifecycle. FIELD_NOTES.md's "Ward entity classes"
	// section confirms CDOTA_NPC_Observer_Ward as the placed-in-world unit
	// (the unplaced backpack item, CDOTA_Item_ObserverWard, is a different
	// class and not relevant here). The sentry ward class is genuinely
	// unknown — this fixture had zero sentry wards placed, so SenLog/
	// SenLeftLog are deliberately left unpopulated rather than guessed at
	// by analogy with the observer ward's name. isSentry is always false
	// below; recordWardPlaced/recordWardRemoved keep the parameter so
	// wiring in a confirmed sentry class later is a one-line addition to
	// this switch, not a rewrite.
	p.OnEntity(func(e *manta.Entity, op manta.EntityOp) error {
		if e.GetClassName() != "CDOTA_NPC_Observer_Ward" {
			return nil
		}
		if !gameStartSet {
			return nil
		}
		x, xok := cellPosition(e, "CBodyComponent.m_cellX", "CBodyComponent.m_vecX")
		y, yok := cellPosition(e, "CBodyComponent.m_cellY", "CBodyComponent.m_vecY")
		if !xok || !yok {
			return nil
		}
		matchTime := float64(p.NetTick)/tickRate - gameStartTime
		ownerSlot, ok := wardOwnerSlot(x, y, heroPositions)
		if !ok {
			return nil
		}
		if op.Flag(manta.EntityOpCreated) {
			recordWardPlaced(players, ownerSlot, false, x, y, matchTime)
		}
		if op.Flag(manta.EntityOpDeleted) {
			recordWardRemoved(players, ownerSlot, false, x, y, matchTime)
		}
		return nil
	})

	// sampleTeamData reads one side's per-minute economy snapshot off
	// CDOTA_DataRadiant/CDOTA_DataDire. slotOffset is 0 for Radiant (match
	// slots 0-4) and 128 for Dire (match slots 128-132) — Task 6's Step 0
	// verification confirmed this team-relative m_vecDataTeam.<0-4> slot
	// numbering lines up directly with the match-slot numbering used
	// everywhere else in this parser (see FIELD_NOTES.md's "Entity
	// contamination" / slot-alignment section), so no remapping is
	// needed: which entity (Radiant vs Dire) this read comes from already
	// tells us the side.
	sampleTeamData := func(e *manta.Entity, matchTime float64, slotOffset int) {
		minute := int(matchTime / 60)
		for slot := 0; slot < 5; slot++ {
			reliable, ok1 := e.GetInt32(fmt.Sprintf("m_vecDataTeam.%04d.m_iReliableGold", slot))
			unreliable, ok2 := e.GetInt32(fmt.Sprintf("m_vecDataTeam.%04d.m_iUnreliableGold", slot))
			lh, ok3 := e.GetInt32(fmt.Sprintf("m_vecDataTeam.%04d.m_iLastHitCount", slot))
			dn, ok4 := e.GetInt32(fmt.Sprintf("m_vecDataTeam.%04d.m_iDenyCount", slot))
			if !ok1 || !ok2 || !ok3 || !ok4 {
				continue
			}
			key := fmtSlot(slotOffset + slot)
			pl := players[key]
			if pl == nil {
				continue
			}
			last := lastSampledMinute[key]
			// xp filled in separately by the hero callback above, via xpBySlot
			sampleMinute(pl, minute, reliable+unreliable, lh, dn, xpBySlot[key], &last)
			lastSampledMinute[key] = last
		}
	}

	p.OnEntity(func(e *manta.Entity, op manta.EntityOp) error {
		if !op.Flag(manta.EntityOpUpdated) || !gameStartSet || gameEndSet {
			return nil
		}
		matchTime := float64(p.NetTick)/tickRate - gameStartTime
		if matchTime < 0 {
			return nil
		}
		switch e.GetClassName() {
		case "CDOTA_DataRadiant":
			sampleTeamData(e, matchTime, 0)
		case "CDOTA_DataDire":
			sampleTeamData(e, matchTime, 128)
		}
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
		handleKillAttribution(players, heroNameToSlot, rk.attacker, rk.victim, ev.T)
	}

	pm := &ParsedMatch{
		MatchID:    matchID,
		Duration:   duration,
		Players:    players,
		Kills:      kills,
		Objectives: objectives,
	}
	if slot, ok := firstBloodSlot(pm.Kills, heroNameToSlot); ok {
		pm.Players[fmtSlot(slot)].FirstbloodClaimed = 1
	}

	for _, pl := range pm.Players {
		laningEndMinute := laningPhaseEndSeconds / 60
		if len(pl.LhT) > laningEndMinute {
			pct := laneEfficiencyPct(pl.LhT[laningEndMinute], laningEndMinute)
			pl.LaneEfficiencyPct = &pct
		}
	}

	return pm, nil
}

// fmtSlot renders a player_slot (0-4 Radiant, 128-132 Dire) as the string
// key used by ParsedMatch.Players and every other per-player map in this
// package.
func fmtSlot(slot int) string { return fmt.Sprintf("%d", slot) }

// matchTimeOf converts a combat log entry's raw timestamp (same clock as
// m_flGameStartTime) into match clock seconds, exactly like the existing
// kill-timestamp handling (rk.ts - gameStartTime).
func matchTimeOf(m *dota.CMsgDOTACombatLogEntry, gameStartTime float64) float64 {
	return float64(m.GetTimestamp()) - gameStartTime
}

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
