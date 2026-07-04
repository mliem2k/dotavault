package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/dotabuff/manta"
)

// PositionPoint is one sampled hero position, in the same ~64-192 world-grid
// cell scale OpenDota's obs_log/deaths_pos already use, so the frontend can
// feed these straight into the existing minimap interpolation without any
// unit conversion.
type PositionPoint struct {
	T float64 `json:"t"` // match clock, seconds
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Dota 2 Source 2 replays tick at a fixed 30Hz. This is a stable, widely
// relied-upon community constant (clarity/manta-based tools all assume it),
// not something the demo header exposes directly.
const tickRate = 30.0

// ExtractPositions parses a decompressed .dem stream and returns one
// position series per player_slot (0-4 Radiant, 128-132 Dire), sampled at
// roughly 1Hz to keep the payload small, plus the match duration in seconds.
func ExtractPositions(dem io.Reader) (map[int][]PositionPoint, float64, error) {
	p, err := manta.NewStreamParser(dem)
	if err != nil {
		return nil, 0, fmt.Errorf("create parser: %w", err)
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
		positions[slot] = append(positions[slot], PositionPoint{T: matchTime, X: x, Y: y})
		return nil
	})

	if err := p.Start(); err != nil {
		// manta returns an error at end-of-stream for most replays; only
		// treat it as fatal if we extracted nothing at all.
		if len(positions) == 0 {
			return nil, 0, fmt.Errorf("parse: %w", err)
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

	return positions, duration, nil
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
