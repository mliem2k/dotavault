package main

// handleDispel is called from ExtractMatch's combat-log handling
// (parser.go) for every MODIFIER_REMOVE entry with ModifierPurged set,
// i.e. a forced removal, not the modifier's own natural expiry.
//
// Confirmed live against match 8921338975's real combat log before writing
// this: purgeNpc (ModifierPurgeNpc, resolved to a hero name the same way as
// every other combat-log identity field) is who cast the dispelling
// ability, e.g. the hero who activated their own Manta Style or a
// Black King Bar. attackerHero (the debuff's original caster) is
// irrelevant to who performed the dispel and intentionally unused here.
// target usually equals purgeNpc (most dispels are self-cast) but can
// differ for an ally-targeted dispel (Guardian Greaves, Oracle
// Purification): credit still goes to purgeNpc, the one who acted.
//
// modifierAbility identifies the specific ability whose effect was removed
// more reliably than inflictor: one real sample had inflictor
// "modifier_stunned" (a generic wrapper) while modifierAbility carried the
// actual stunning ability's name. inflictor is used only as a fallback for
// when modifierAbility didn't resolve.
func handleDispel(
	players map[string]*PlayerParsed,
	heroNameToSlot map[string]int,
	purgeNpc, purgeAbility, target, modifierAbility, inflictor string,
	duration, t float64,
) {
	slot, ok := heroNameToSlot[purgeNpc]
	if !ok {
		return
	}
	modifier := modifierAbility
	if modifier == "" || modifier == "dota_unknown" {
		modifier = inflictor
	}
	p := players[fmtSlot(slot)]
	p.DispelsLog = append(p.DispelsLog, DispelEvent{
		T: t, Target: target, Modifier: modifier, PurgeAbility: purgeAbility, Duration: duration,
	})
}
