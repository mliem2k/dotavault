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
