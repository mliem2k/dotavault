package main

import "fmt"

// handlePurchase/handleRunePickup/handleStun/handleBuyback are called from
// ExtractMatch's single OnCMsgDOTACombatLogEntry callback (parser.go), one
// per combat log type. heroNameToSlot resolves a hero internal name (from
// CombatLogNames) to a player_slot key.

func recordPurchase(p *PlayerParsed, itemKey string, t float64) {
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

// handlePurchase logs one PURCHASE combat log entry, with one dedup rule:
// buying from the shared "Wards" shop slot fires TWO combat log PURCHASE
// entries at the exact same timestamp — a generic "ward_dispenser" (the
// container) immediately followed by the specific charge granted
// ("ward_observer" or "ward_sentry"). Confirmed empirically against a real
// match: every dispenser+specific pair shares an identical float timestamp,
// and the dispenser entry always arrives first (227 purchase-log entries
// checked, zero counterexamples). Logging both as separate purchases would
// double the real number of ward buys (one match showed 176 raw ward
// purchase-log entries for a single support in 95 minutes — implausible for
// a real player), so the generic entry is held back one call and only
// recorded on its own if no specific pair shows up right behind it.
// pendingWardDispenser must be flushed via flushPendingWardDispensers after
// the demo finishes streaming, in case a held dispenser is the very last
// ward purchase logged for its slot.
func handlePurchase(players map[string]*PlayerParsed, heroNameToSlot map[string]int, pendingWardDispenser map[int]float64, buyerHero, itemKey string, t float64) {
	slot, ok := heroNameToSlot[buyerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]

	if heldT, held := pendingWardDispenser[slot]; held {
		delete(pendingWardDispenser, slot)
		isPair := heldT == t && (itemKey == "ward_observer" || itemKey == "ward_sentry")
		if !isPair {
			recordPurchase(p, "ward_dispenser", heldT)
		}
	}

	if itemKey == "ward_dispenser" {
		pendingWardDispenser[slot] = t
		return
	}

	recordPurchase(p, itemKey, t)
}

// flushPendingWardDispensers records any ward_dispenser purchase that was
// still awaiting its specific-charge pair when the demo stream ended.
func flushPendingWardDispensers(players map[string]*PlayerParsed, pendingWardDispenser map[int]float64) {
	for slot, t := range pendingWardDispenser {
		recordPurchase(players[fmtSlot(slot)], "ward_dispenser", t)
		delete(pendingWardDispenser, slot)
	}
}

// handleStun accumulates stun/disable duration this hero INFLICTED on
// enemies (the same offensive convention OpenDota's own `stuns` stat uses),
// from MODIFIER_ADD combat log entries. stun_duration is Valve's own final,
// already-reduced duration for the effect being applied (confirmed against
// a real match: covers the universal modifier_stunned as well as
// hero-specific disables like Earthshaker's Fissure root or Dark Willow's
// Bramble Maze), and attacker is the caster who applied it — unlike the
// Modifiers slice (modifiers.go), which is keyed by the entity the buff sits
// ON (the victim), the opposite axis from what this stat means.
func handleStun(players map[string]*PlayerParsed, heroNameToSlot map[string]int, casterHero string, stunDuration float32) {
	if stunDuration <= 0 {
		return
	}
	slot, ok := heroNameToSlot[casterHero]
	if !ok {
		return
	}
	players[fmtSlot(slot)].Stuns += float64(stunDuration)
}

// handleBuyback records a buyback event. Value on a BUYBACK combat log
// entry is the buying-back player's CDOTA_PlayerResource global 0-9 index
// (confirmed empirically: correlating BUYBACK timestamps against this same
// player's nearby death-loss GOLD entries lines up cleanly across a whole
// real match, with zero mismatches) — the same numbering
// playerIDToMatchSlot already converts for chat/pings, not the doubled
// hero-entity m_iPlayerID scheme playerSlot() expects. latestNetWorth is
// this hero's most recently sampled net worth (see sampleTeamData), used to
// estimate the buyback's gold cost since the replay never logs it directly
// (see BuybackEvent.Gold's doc comment in types.go for why this is an
// estimate, not an observed value).
func handleBuyback(players map[string]*PlayerParsed, playerIDToTeam map[int]int, latestNetWorth map[string]int32, value uint32, t float64) {
	playerID := int(value)
	team, ok := playerIDToTeam[playerID]
	if !ok {
		return
	}
	slot := playerIDToMatchSlot(playerID, team)
	key := fmtSlot(slot)
	p := players[key]
	p.BuybackCount++
	netWorth := latestNetWorth[key]
	p.BuybackLog = append(p.BuybackLog, BuybackEvent{
		T:          t,
		Slot:       int32(slot),
		PlayerSlot: int32(slot),
		Gold:       200 + netWorth/13,
	})
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
