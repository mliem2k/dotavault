package main

import (
	"sort"

	"github.com/dotabuff/manta"
)

// CreepPositionPoint is one sampled non-hero unit snapshot, same ~64-192
// world-grid scale and 1Hz sampling as PositionPoint, but without the
// hero-only fields (level/mana/attack stats don't apply here).
type CreepPositionPoint struct {
	T  float64 `json:"t"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	HP int32   `json:"hp"`
}

// CreepInstance is one non-hero unit's full lifetime in the replay: a
// lane/siege creep wave spawn, a neutral camp creep, Roshan, or Tormentor.
// Team is 2 (Radiant) / 3 (Dire) for lane and siege creeps, matching the
// hero playerSlot convention, or 4 (neutral) for camp creeps, Roshan, and
// Tormentor, confirmed empirically against testdata/fixture.dem.bz2 (a
// real CDOTA_BaseNPC_Creep_Neutral and CDOTA_Unit_Roshan both read
// m_iTeamNum=4).
//
// There's no explicit end-of-life sample: once a creep dies or a wave
// despawns, its entity is destroyed and simply stops receiving updates, so
// its Positions series just ends. The frontend treats a creep as gone once
// its last sample falls more than a couple of seconds behind the current
// playback time, rather than needing an explicit death flag here.
type CreepInstance struct {
	Kind      string               `json:"kind"` // "lane", "siege", "neutral", "roshan", "tormentor"
	Team      int32                `json:"team"`
	Positions []CreepPositionPoint `json:"positions"`
}

// creepKind maps an entity class name to the Kind this parser tracks, or
// ("", false) for anything else (abilities, spawners, item stashes, etc,
// see apps/replay-parser's CLASS_FILTER inspect output for the full
// family). "tormentor" is best effort and NOT verified against a real
// replay: testdata/fixture.dem.bz2 never spawns one, so this name comes
// from public Dota 2 modding references, not an empirical check like every
// other entry here. If it's wrong, this simply never matches and
// Tormentor is silently absent from Creeps, same as today, no crash risk
// either way.
func creepKind(className string) (string, bool) {
	switch className {
	case "CDOTA_BaseNPC_Creep_Lane":
		return "lane", true
	case "CDOTA_BaseNPC_Creep_Siege":
		return "siege", true
	case "CDOTA_BaseNPC_Creep_Neutral":
		return "neutral", true
	case "CDOTA_Unit_Roshan":
		return "roshan", true
	case "CDOTA_Unit_Tormentor":
		return "tormentor", true
	default:
		return "", false
	}
}

type creepMeta struct {
	kind string
	team int32
}

// trackCreeps samples every lane/siege/neutral creep, Roshan, and (best
// effort) Tormentor at 1Hz, keyed by the entity's own stable index (same
// identity approach as wardOwnerByIndex in parser.go, since creeps have no
// player_slot to key by). gameClock reports the current match time and
// whether sampling should be active right now (mirrors the hero
// callback's own gameStartSet/gameEndSet gating in parser.go): creeps
// never need the pregame buffering heroes do, since lane/siege creeps
// don't exist before GAME_IN_PROGRESS; Roshan and neutral camps do exist
// slightly earlier, but losing their first ~90s of (near stationary)
// pregame samples is a negligible, deliberate simplification.
func trackCreeps(p *manta.Parser, gameClock func() (matchTime float64, active bool)) func() []CreepInstance {
	positions := map[int32][]CreepPositionPoint{}
	meta := map[int32]creepMeta{}
	lastEmittedSecond := map[int32]int{}
	var done []CreepInstance

	// flush finalizes whatever's tracked under idx (if anything was ever
	// sampled) into done and clears all per-index state. Manta reuses an
	// entity's index for a brand new, unrelated entity once the old one is
	// destroyed (confirmed empirically against this package's fixture: 234
	// creep-class index-reuse events in one 11.6-minute Turbo match, often
	// across different Kinds, e.g. a lane creep's index immediately
	// reassigned to a neutral camp creep). Without this reset, the next
	// entity to reuse idx would silently keep appending to the previous,
	// unrelated creep's Positions slice under its stale Kind/Team, splicing
	// two different creeps' lifetimes into one CreepInstance with an
	// impossible spatial jump in the middle.
	flush := func(idx int32) {
		if pts := positions[idx]; len(pts) > 0 {
			done = append(done, CreepInstance{Kind: meta[idx].kind, Team: meta[idx].team, Positions: pts})
		}
		delete(positions, idx)
		delete(meta, idx)
		delete(lastEmittedSecond, idx)
	}

	p.OnEntity(func(e *manta.Entity, op manta.EntityOp) error {
		kind, ok := creepKind(e.GetClassName())
		if !ok {
			return nil
		}
		idx := e.GetIndex()
		if op.Flag(manta.EntityOpDeleted) {
			flush(idx)
			return nil
		}
		if !op.Flag(manta.EntityOpUpdated) {
			return nil
		}
		matchTime, active := gameClock()
		if !active {
			return nil
		}
		second := int(matchTime)
		if lastEmittedSecond[idx] == second && len(positions[idx]) > 0 {
			return nil // already have a sample for this second
		}
		x, xok := cellPosition(e, "CBodyComponent.m_cellX", "CBodyComponent.m_vecX")
		y, yok := cellPosition(e, "CBodyComponent.m_cellY", "CBodyComponent.m_vecY")
		if !xok || !yok {
			return nil
		}
		lastEmittedSecond[idx] = second
		if _, seen := meta[idx]; !seen {
			team, _ := e.Get("m_iTeamNum").(uint64)
			meta[idx] = creepMeta{kind: kind, team: int32(team)}
		}
		hp, _ := e.Get("m_iHealth").(int32)
		positions[idx] = append(positions[idx], CreepPositionPoint{T: matchTime, X: x, Y: y, HP: hp})
		return nil
	})

	return func() []CreepInstance {
		creeps := make([]CreepInstance, 0, len(done)+len(positions))
		creeps = append(creeps, done...)
		for idx, pts := range positions {
			creeps = append(creeps, CreepInstance{Kind: meta[idx].kind, Team: meta[idx].team, Positions: pts})
		}
		// Map iteration order is random; sort by first-seen time so output
		// (and therefore any test asserting on it) is deterministic.
		sort.Slice(creeps, func(i, j int) bool {
			return creeps[i].Positions[0].T < creeps[j].Positions[0].T
		})
		return creeps
	}
}
