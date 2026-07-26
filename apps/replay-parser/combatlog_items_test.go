package main

import "testing"

func TestExtractMatch_Purchases(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for slot, p := range pm.Players {
		if len(p.PurchaseLog) > 0 {
			found = true
			first := p.PurchaseLog[0]
			if first.Key == "" {
				t.Errorf("player %s: purchase_log[0].key is empty", slot)
			}
			if first.T < -120 { // pre-horn purchases are allowed but not absurdly early
				t.Errorf("player %s: purchase_log[0].time = %v, implausible", slot, first.T)
			}
		}
	}
	if !found {
		t.Fatal("no purchases extracted from any player")
	}
}

func TestExtractMatch_PurchaseCounts(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for slot, p := range pm.Players {
		if len(p.PurchaseLog) == 0 {
			continue
		}
		if len(p.Purchase) == 0 {
			t.Errorf("player %s: has %d purchase_log entries but purchase map is empty", slot, len(p.PurchaseLog))
			continue
		}
		found = true
		// Internal-consistency check: Purchase is a per-item count derived
		// from the exact same PURCHASE combat log entries as PurchaseLog, so
		// summing all counts must equal the log's length for that player.
		var sum int32
		for _, n := range p.Purchase {
			if n <= 0 {
				t.Errorf("player %s: purchase count = %d, want > 0", slot, n)
			}
			sum += n
		}
		if int(sum) != len(p.PurchaseLog) {
			t.Errorf("player %s: sum(purchase values)=%d != len(purchase_log)=%d", slot, sum, len(p.PurchaseLog))
		}
	}
	if !found {
		t.Fatal("no purchase counts extracted from any player")
	}
}

// newTestPlayers builds a minimal players map for the match_id=1 fixture's
// slot convention, enough for handlePurchase/handleStun/handleBuyback unit
// tests that don't need a real replay.
func newTestPlayers() map[string]*PlayerParsed {
	players := map[string]*PlayerParsed{}
	for _, slot := range []int{0, 1, 2, 3, 4, 128, 129, 130, 131, 132} {
		players[fmtSlot(slot)] = &PlayerParsed{}
	}
	return players
}

func TestHandlePurchase_DedupsWardDispenserPair(t *testing.T) {
	// Buying from the shared "Wards" shop slot fires ward_dispenser
	// immediately followed by ward_sentry/ward_observer at the identical
	// timestamp (confirmed empirically — see handlePurchase's doc comment).
	// That's one real purchase and must be logged once, not twice.
	players := newTestPlayers()
	heroNameToSlot := map[string]int{"npc_dota_hero_lion": 129}
	pending := map[int]float64{}

	handlePurchase(players, heroNameToSlot, pending, "npc_dota_hero_lion", "ward_dispenser", 100.0)
	handlePurchase(players, heroNameToSlot, pending, "npc_dota_hero_lion", "ward_sentry", 100.0)

	p := players["129"]
	if len(p.PurchaseLog) != 1 {
		t.Fatalf("purchase_log = %v, want exactly 1 entry (dispenser+sentry pair collapsed)", p.PurchaseLog)
	}
	if p.PurchaseLog[0].Key != "ward_sentry" {
		t.Errorf("purchase_log[0].key = %q, want the specific charge type, not the generic container", p.PurchaseLog[0].Key)
	}
	if p.Purchase["ward_dispenser"] != 0 {
		t.Errorf("purchase[ward_dispenser] = %d, want 0 (only the specific type should be counted)", p.Purchase["ward_dispenser"])
	}
}

func TestHandlePurchase_KeepsUnpairedWardDispenser(t *testing.T) {
	// A ward_dispenser with no specific-type pair right behind it (its
	// specific charge entry never arrived, or this is a genuinely solo
	// purchase) must still be recorded — dropping it would undercount.
	players := newTestPlayers()
	heroNameToSlot := map[string]int{"npc_dota_hero_lion": 129}
	pending := map[int]float64{}

	handlePurchase(players, heroNameToSlot, pending, "npc_dota_hero_lion", "ward_dispenser", 100.0)
	handlePurchase(players, heroNameToSlot, pending, "npc_dota_hero_lion", "tango", 105.0)

	p := players["129"]
	if len(p.PurchaseLog) != 2 {
		t.Fatalf("purchase_log = %v, want 2 entries (unpaired dispenser + tango)", p.PurchaseLog)
	}
	if p.PurchaseLog[0].Key != "ward_dispenser" || p.PurchaseLog[1].Key != "tango" {
		t.Errorf("purchase_log = %v, want [ward_dispenser, tango] in order", p.PurchaseLog)
	}
}

func TestFlushPendingWardDispensers_RecordsHeldEntry(t *testing.T) {
	// A ward_dispenser held pending its specific-type pair when the demo
	// stream ends must still be flushed into the log, not silently lost.
	players := newTestPlayers()
	heroNameToSlot := map[string]int{"npc_dota_hero_lion": 129}
	pending := map[int]float64{}

	handlePurchase(players, heroNameToSlot, pending, "npc_dota_hero_lion", "ward_dispenser", 5000.0)
	flushPendingWardDispensers(players, pending)

	p := players["129"]
	if len(p.PurchaseLog) != 1 || p.PurchaseLog[0].Key != "ward_dispenser" {
		t.Fatalf("purchase_log = %v, want the held dispenser flushed", p.PurchaseLog)
	}
	if len(pending) != 0 {
		t.Errorf("pending map still has %d entries after flush, want 0", len(pending))
	}
}

func TestHandleStun_SumsByAttackerNotTarget(t *testing.T) {
	// Stuns is an offensive stat (duration this hero inflicted on enemies),
	// the opposite axis from the Modifiers slice (which is keyed by who the
	// buff sits ON, i.e. the victim) — see handleStun's doc comment.
	players := newTestPlayers()
	heroNameToSlot := map[string]int{
		"npc_dota_hero_earthshaker": 0,
		"npc_dota_hero_lich":        128,
	}

	handleStun(players, heroNameToSlot, "npc_dota_hero_earthshaker", 1.0)
	handleStun(players, heroNameToSlot, "npc_dota_hero_earthshaker", 1.5)
	handleStun(players, heroNameToSlot, "npc_dota_hero_earthshaker", 0) // no-op: not a real stun

	if got, want := players["0"].Stuns, 2.5; got != want {
		t.Errorf("caster stuns = %v, want %v", got, want)
	}
	if got := players["128"].Stuns; got != 0 {
		t.Errorf("victim (never an attacker here) stuns = %v, want 0", got)
	}
}

func TestHandleBuyback_ResolvesSlotAndEstimatesGold(t *testing.T) {
	// Value on a BUYBACK entry is CDOTA_PlayerResource's flat 0-9 global
	// player index (0-4 Radiant, 5-9 Dire) — confirmed empirically by
	// correlating BUYBACK timestamps against death-loss GOLD entries across
	// a real match — not the doubled 0,2,4.../10,12,14... m_iPlayerID
	// scheme playerSlot() expects elsewhere in this parser.
	players := newTestPlayers()
	playerIDToTeam := map[int]int{6: 3} // global index 6 = Dire
	latestNetWorth := map[string]int32{"129": 9100}

	handleBuyback(players, playerIDToTeam, latestNetWorth, 6, 1234.5)

	p := players["129"] // 128 + (6-5)
	if len(p.BuybackLog) != 1 {
		t.Fatalf("buyback_log = %v, want exactly 1 entry", p.BuybackLog)
	}
	ev := p.BuybackLog[0]
	if ev.T != 1234.5 {
		t.Errorf("buyback time = %v, want 1234.5", ev.T)
	}
	if ev.Slot != 129 || ev.PlayerSlot != 129 {
		t.Errorf("buyback slot=%d player_slot=%d, want 129 (global index 6 -> Dire slot 1)", ev.Slot, ev.PlayerSlot)
	}
	// floor(200 + 9100/13) = 200 + 700 = 900
	if ev.Gold != 900 {
		t.Errorf("estimated gold = %d, want 900 (200 + net_worth/13)", ev.Gold)
	}
	if p.BuybackCount != 1 {
		t.Errorf("buyback_count = %d, want 1", p.BuybackCount)
	}
}

func TestExtractMatch_Runes(t *testing.T) {
	// FIELD_NOTES.md: this fixture has zero PICKUP_RUNE occurrences (an
	// 11.6-minute Turbo match where nobody happened to grab a rune), so
	// this only checks internal consistency (pickups count matches log
	// length), not that any runes were actually picked up. A future fixture
	// with real rune pickups should tighten this to assert nonzero.
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	for slot, p := range pm.Players {
		if p.RunePickups != int32(len(p.RunesLog)) {
			t.Errorf("player %s: rune_pickups (%d) != len(runes_log) (%d)", slot, p.RunePickups, len(p.RunesLog))
		}
	}
}
