package main

// rawArmorDebuffCast buffers a MODIFIER_ADD combat log entry flagged
// ArmorDebuffModifier, by raw demo-clock second, same "buffer now, convert
// after" reason as rawKills/rawPhysicalHits: gameStartTime isn't known yet
// for any event that arrives during pregame. duration comes directly from
// the same combat log entry's own ModifierDuration field, giving the
// debuff's active window with no further correlation needed.
type rawArmorDebuffCast struct {
	rawT                   float64
	casterSlot, targetSlot int
	abilityName            string
	duration               float64
}

// applyAllyDamageContribution is a PROXY, not a precise causal estimate.
// The original design tried to compute exactly how much MORE damage an
// armor debuff let through, using the same before/after armor-formula
// technique as physicalMitigation. That requires the debuff's actual
// armor delta, which turned out not to be reliably available: every real
// armor debuff sampled across a real match (Shadow Fiend's aura, Blight
// Stone, Medallion of Courage's active, even a neutral creep ability) read
// 0 in the modifier buff-table stream that would otherwise carry it, 4 for
// 4 with no exceptions. Only self/environmental buffs (e.g. Tower Aura
// Bonus) populate that field. Valve evidently computes enemy-applied
// debuffs through a different path that doesn't network the delta this
// way.
//
// Instead, this credits a debuff's caster with the total physical damage
// their allies dealt to the debuffed target while the debuff was active
// (scoped to physical damage specifically, since armor debuffs only affect
// physical damage in Dota; magical/pure damage is unaffected either way).
// This is "how much ally damage happened during your debuff," not "how
// much your debuff caused". Some of that damage would have landed
// regardless. Overlapping debuffs from different casters on the same
// target each independently claim credit for the same hit, a second
// acknowledged imprecision on top of the first.
func applyAllyDamageContribution(players map[string]*PlayerParsed, casts []rawArmorDebuffCast, hits []rawPhysicalHit, gameStartTime float64) {
	type window struct {
		casterSlot   int
		startT, endT float64
		abilityName  string
	}
	windowsByTarget := map[int][]window{}
	for _, c := range casts {
		if c.duration <= 0 {
			continue // no reliable window without the debuff's own nominal duration
		}
		castT := c.rawT - gameStartTime
		windowsByTarget[c.targetSlot] = append(windowsByTarget[c.targetSlot], window{
			casterSlot: c.casterSlot, startT: castT, endT: castT + c.duration, abilityName: c.abilityName,
		})
	}
	if len(windowsByTarget) == 0 {
		return
	}

	for _, h := range hits {
		windows := windowsByTarget[h.targetSlot]
		if len(windows) == 0 {
			continue
		}
		hitT := h.rawT - gameStartTime
		for _, w := range windows {
			if hitT < w.startT || hitT > w.endT {
				continue
			}
			if h.attackerSlot == w.casterSlot {
				continue // the caster's own damage isn't "ally" contribution
			}
			if (h.attackerSlot < 128) != (w.casterSlot < 128) {
				continue // not on the same team as the caster
			}
			caster := players[fmtSlot(w.casterSlot)]
			if caster.AllyDamageContribution == nil {
				caster.AllyDamageContribution = map[string]int32{}
			}
			caster.AllyDamageContribution[w.abilityName] += h.value
		}
	}
}
