package main

import "testing"

func TestExtractMatch_LanePos(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for _, p := range pm.Players {
		if len(p.LanePos) > 0 {
			found = true
		}
	}
	if !found {
		t.Fatal("no lane_pos extracted from any player")
	}
}

func TestLaneEfficiencyPct(t *testing.T) {
	// A hero with 40 last hits and 4000 gold_t/xp_t by minute 10 (laning
	// phase end) against a theoretical max of 100 last hits should show
	// meaningfully less than 100%.
	pct := laneEfficiencyPct(40, 10)
	if pct <= 0 || pct >= 100 {
		t.Errorf("laneEfficiencyPct(40, 10) = %v, want in (0, 100)", pct)
	}
	full := laneEfficiencyPct(100, 10)
	if full <= pct {
		t.Errorf("laneEfficiencyPct(100, 10) = %v, want > laneEfficiencyPct(40, 10) = %v", full, pct)
	}
}
