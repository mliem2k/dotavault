package main

// handleHeal is called from ExtractMatch's combat-log handling
// (parser.go) for every HEAL entry. attacker is the healer, target is the
// recipient, confirmed live against match 8921338975's real combat log
// (Necrolyte's Death Pulse consistently had attacker=Necrolyte whether the
// target was himself or an ally).
//
// Passive HP regen and lifesteal both carry an empty or dota_unknown
// inflictor in the combat log (no ability cast them), so they're bucketed
// under synthetic "regen"/"lifesteal" keys instead, identified by the
// entry's own HealFromRegen/HealFromLifesteal flags. A named ability/item
// inflictor keeps its own key, same convention as DamageInflictor.
func handleHeal(
	players map[string]*PlayerParsed,
	heroNameToSlot map[string]int,
	healerHero, targetHero, inflictor string,
	fromRegen, fromLifesteal bool,
	amount int32,
) {
	key := inflictor
	switch {
	case fromRegen:
		key = "regen"
	case fromLifesteal:
		key = "lifesteal"
	}

	_, targetIsHero := heroNameToSlot[targetHero]

	if hSlot, ok := heroNameToSlot[healerHero]; ok {
		p := players[fmtSlot(hSlot)]
		if p.HealingDealt == nil {
			p.HealingDealt = map[string]int32{}
		}
		p.HealingDealt[key] += amount
		// Per-recipient split, hero recipients only (a heal landing on a
		// creep or courier still counts toward HealingDealt above, it just
		// doesn't get a column in the healing matrix).
		if targetIsHero {
			if p.HealingTargets == nil {
				p.HealingTargets = map[string]map[string]int32{}
			}
			if p.HealingTargets[key] == nil {
				p.HealingTargets[key] = map[string]int32{}
			}
			p.HealingTargets[key][targetHero] += amount
		}
	}
	if tSlot, ok := heroNameToSlot[targetHero]; ok {
		p := players[fmtSlot(tSlot)]
		if p.HealingReceived == nil {
			p.HealingReceived = map[string]int32{}
		}
		p.HealingReceived[key] += amount
	}
}
