package main

import (
	"math"
	"sort"
)

// damageTypePhysical matches Dota's documented VScript/Lua modding API
// (DAMAGE_TYPES_PHYSICAL=1, DAMAGE_TYPES_MAGICAL=2, DAMAGE_TYPES_PURE=4, a
// bitmask, not sequential 0/1/2). Confirmed against a real match's combat
// log: every damage_type=1 entry sampled was a plain autoattack (physical
// by definition), damage_type=2 entries were all named spell inflictors
// (Shackles, Death Pulse, Boulder Smash, all magical), and damage_type=4
// entries were both damage-over-time sources (Doom's ultimate, Blood
// Grenade's bleed, both pure in Dota). damage_type=0 appeared on a handful
// of special-cased abilities (Reaper's Scythe) that evidently bypass the
// normal type tag entirely, not a 4th real damage type. Left untouched by
// the physical-only mitigation estimate below.
const damageTypePhysical = 1

// rawPhysicalHit buffers a physical-damage DAMAGE combat log entry by raw
// demo-clock second, same "buffer now, convert after" reason as rawKills in
// parser.go: the target's armor-at-that-instant can only be looked up from
// Positions once that's fully built (pregame-shifted and sorted), which
// happens after gameStartTime is final.
type rawPhysicalHit struct {
	rawT                     float64
	attackerSlot, targetSlot int
	inflictor                string
	value                    int32
}

// physicalArmorReductionPct is Dota's current (post-7.20) armor formula,
// confirmed via dotabuff.com/blog/2018-11-30-understanding-720-armor-changes
// and cross-checked against that post's own worked example: 0 to 10 armor
// reduces incoming physical damage by ~37.5%, 10 to 20 adds another ~17
// percentage points. Negative or zero armor amplifies damage rather than
// reducing it, clamped to 0 here since "how much was mitigated" should
// never go negative. The raw formula also asymptotically approaches (and
// at implausibly high armor, exceeds) 1.0, which would flip the sign of
// anything dividing by (1 - pct) downstream, so the upper end is clamped
// too, defensively: no realistic in-game armor total gets remotely close
// to the ~225 armor needed to hit this ceiling, even after the
// sanitizeStatBonus fix for corrupt modifier data (modifiers.go).
func physicalArmorReductionPct(armor float64) float64 {
	pct := (0.052 * armor) / (0.9 + 0.048*math.Abs(armor))
	return math.Min(0.95, math.Max(0, pct))
}

// physicalMitigation estimates how much MORE damage postArmorValue would
// have been without the target's armor. postArmorValue is the combat log's
// own DAMAGE entry Value field, which is already final, post-armor, the
// same assumption every Dota stats site makes since the combat log never
// carries a separate pre-mitigation number to compare against.
func physicalMitigation(postArmorValue int32, armor float64) int32 {
	pct := physicalArmorReductionPct(armor)
	if pct <= 0 {
		return 0
	}
	return int32(math.Round(float64(postArmorValue) * pct / (1 - pct)))
}

// armorAt finds a hero's estimated total armor (base plus item/ability
// bonuses, see PositionPoint.Armor's doc comment) at match time t: the
// nearest sample at or before t, since armor is only sampled at the
// position sampler's roughly 1Hz cadence, not on every combat log tick.
// Falls back to the earliest sample if t precedes it (e.g. a pregame hit).
func armorAt(positions []PositionPoint, t float64) (float64, bool) {
	if len(positions) == 0 {
		return 0, false
	}
	idx := sort.Search(len(positions), func(i int) bool { return positions[i].T > t })
	if idx == 0 {
		return positions[0].Armor, true
	}
	return positions[idx-1].Armor, true
}

// applyPhysicalMitigation converts buffered raw physical hits into each
// attacking player's DamageMitigated total, once gameStartTime is final and
// every player's Positions are fully built. Keyed by the same raw inflictor
// string as DamageInflictor so the frontend can pair "damage dealt via X"
// with "damage via X that got mitigated" directly.
func applyPhysicalMitigation(players map[string]*PlayerParsed, hits []rawPhysicalHit, gameStartTime float64) {
	for _, h := range hits {
		target := players[fmtSlot(h.targetSlot)]
		armor, ok := armorAt(target.Positions, h.rawT-gameStartTime)
		if !ok {
			continue
		}
		mitigated := physicalMitigation(h.value, armor)
		if mitigated == 0 {
			continue
		}
		attacker := players[fmtSlot(h.attackerSlot)]
		if attacker.DamageMitigated == nil {
			attacker.DamageMitigated = map[string]int32{}
		}
		attacker.DamageMitigated[h.inflictor] += mitigated
	}
}
