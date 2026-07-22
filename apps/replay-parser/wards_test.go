package main

import "testing"

func TestExtractMatch_Wards(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	totalObs := 0
	for slot, p := range pm.Players {
		totalObs += len(p.ObsLog)
		for _, w := range p.ObsLog {
			if w.X == 0 && w.Y == 0 {
				t.Errorf("player %s: ward at origin (0,0), likely a coordinate bug", slot)
			}
		}
	}
	if totalObs == 0 {
		t.Fatal("no observer wards extracted (every real match has several)")
	}
}

func TestExtractMatch_WardRemovalAttributedToPlacer(t *testing.T) {
	// A ward's removal must be attributed to whoever placed it, not
	// whoever happens to be nearest when it's destroyed (usually the
	// enemy dewarding it, or just whoever's nearby on natural expiry) —
	// so a player can never have an ObsLeftLog entry without having
	// placed at least one ward themselves.
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	for slot, p := range pm.Players {
		if len(p.ObsLeftLog) > 0 && len(p.ObsLog) == 0 {
			t.Errorf("player %s: has %d ObsLeftLog entries but placed no wards (ObsLog empty) — removal misattributed to a non-placer", slot, len(p.ObsLeftLog))
		}
	}
}
