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
