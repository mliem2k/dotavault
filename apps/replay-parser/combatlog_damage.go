package main

import "fmt"

// handleDamage/handleGoldReason/handleXpReason/handleKillAttribution are
// called from ExtractMatch's combat-log handling (parser.go): the first
// three from the single OnCMsgDOTACombatLogEntry callback, one per combat
// log type; handleKillAttribution from the rawKills post-processing loop
// once attacker/victim names and match time are already resolved.
//
// value's semantics were spot-checked against the real fixture with
// -inspect before writing this (see FIELD_NOTES.md): DAMAGE/GOLD/XP entries
// are all small positive per-event deltas (damage 1-501, gold 6-2428 plus a
// one-time 600 starting grant, xp 0-6352), not running totals or some other
// field — confirming the amount assumption this file relies on.
func handleDamage(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero, targetHero, inflictor string, amount int32) {
	if aSlot, ok := heroNameToSlot[attackerHero]; ok {
		p := players[fmtSlot(aSlot)]
		if p.Damage == nil {
			p.Damage = map[string]int32{}
		}
		p.Damage[targetHero] += amount
		if p.DamageInflictor == nil {
			p.DamageInflictor = map[string]int32{}
		}
		p.DamageInflictor[inflictor] += amount
		if p.DamageTargets == nil {
			p.DamageTargets = map[string]map[string]int32{}
		}
		if p.DamageTargets[inflictor] == nil {
			p.DamageTargets[inflictor] = map[string]int32{}
		}
		p.DamageTargets[inflictor][targetHero] += amount
		// hero_hits only counts hits landing on an actual hero (not creeps,
		// towers, wards, etc.) — heroNameToSlot resolving targetHero is the
		// same "is this a hero" check used everywhere else in this file. The
		// key is normalized to the literal string "null" for a plain attack
		// (inflictor arrives as "dota_unknown", from clName resolving
		// string-table index 0, or empty) to match what the frontend
		// (apps/web/src/components/match/match_casts.tsx) reads via
		// player.hero_hits?.null.
		if _, targetIsHero := heroNameToSlot[targetHero]; targetIsHero {
			if p.HeroHits == nil {
				p.HeroHits = map[string]int32{}
			}
			key := inflictor
			if key == "" || key == "dota_unknown" {
				key = "null"
			}
			p.HeroHits[key]++
		}
	}
	if tSlot, ok := heroNameToSlot[targetHero]; ok {
		p := players[fmtSlot(tSlot)]
		if p.DamageTaken == nil {
			p.DamageTaken = map[string]int32{}
		}
		p.DamageTaken[attackerHero] += amount
	}
}

func handleGoldReason(players map[string]*PlayerParsed, heroNameToSlot map[string]int, targetHero string, reason uint32, value int32) {
	slot, ok := heroNameToSlot[targetHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if p.GoldReasons == nil {
		p.GoldReasons = map[string]int32{}
	}
	p.GoldReasons[fmt.Sprintf("%d", reason)] += value
}

func handleXpReason(players map[string]*PlayerParsed, heroNameToSlot map[string]int, targetHero string, reason uint32, value int32) {
	slot, ok := heroNameToSlot[targetHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if p.XpReasons == nil {
		p.XpReasons = map[string]int32{}
	}
	p.XpReasons[fmt.Sprintf("%d", reason)] += value
}

func handleKillAttribution(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero, victimHero string, t float64) {
	if aSlot, ok := heroNameToSlot[attackerHero]; ok {
		p := players[fmtSlot(aSlot)]
		p.KillsLog = append(p.KillsLog, KillLogEntry{T: t, Key: victimHero})
		if p.Killed == nil {
			p.Killed = map[string]int32{}
		}
		p.Killed[victimHero]++
	}
}
