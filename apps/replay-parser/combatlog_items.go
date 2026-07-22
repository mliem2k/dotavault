package main

import "fmt"

// handlePurchase/handleRunePickup are called from ExtractMatch's single
// OnCMsgDOTACombatLogEntry callback (parser.go), one per combat log type.
// heroNameToSlot resolves a hero internal name (from CombatLogNames) to a
// player_slot key. No handleBuyback here — see the task text above for why
// buyback attribution isn't attempted in this task.

func handlePurchase(players map[string]*PlayerParsed, heroNameToSlot map[string]int, buyerHero, itemKey string, t float64) {
	slot, ok := heroNameToSlot[buyerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	p.PurchaseLog = append(p.PurchaseLog, PurchaseEvent{Key: itemKey, T: t})
	// OpenDota's real `purchase` field is a per-item count (e.g.
	// {"tango": 1, "ward_observer": 3}), trivially derivable from the same
	// PURCHASE combat log entries feeding PurchaseLog above — unlike
	// OpenDota's cost-summed semantics for other fields, this one needs no
	// cost data (which combat log PURCHASE entries don't carry anyway).
	if p.Purchase == nil {
		p.Purchase = map[string]int32{}
	}
	p.Purchase[itemKey]++
}

func handleRunePickup(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero string, runeType uint32, t float64) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	// Raw numeric rune_type — FIELD_NOTES.md couldn't determine a name
	// mapping (zero PICKUP_RUNE occurrences in the fixture), so key is the
	// raw integer as a string, matching how gold_reasons/xp_reasons are
	// also stored as raw integer keys.
	p.RunesLog = append(p.RunesLog, RuneEvent{T: t, Key: fmt.Sprintf("%d", runeType)})
	p.RunePickups++
}
