package main

import "testing"

func TestExtractMatch_TimeSeries(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	expectedMinutes := int(pm.Duration / 60)
	for slot, p := range pm.Players {
		if len(p.GoldT) == 0 {
			t.Errorf("player %s: gold_t is empty", slot)
			continue
		}
		if len(p.GoldT) < expectedMinutes-1 || len(p.GoldT) > expectedMinutes+2 {
			t.Errorf("player %s: len(gold_t)=%d, want close to duration/60=%d", slot, len(p.GoldT), expectedMinutes)
		}
		for i := 1; i < len(p.LhT); i++ {
			if p.LhT[i] < p.LhT[i-1] {
				t.Errorf("player %s: lh_t not monotonically non-decreasing at minute %d (%d -> %d)", slot, i, p.LhT[i-1], p.LhT[i])
			}
		}
	}
}
