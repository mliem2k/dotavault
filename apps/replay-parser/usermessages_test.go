package main

import "testing"

func TestExtractMatch_Pings(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	total := int32(0)
	for _, p := range pm.Players {
		if p.Pings != nil {
			total += *p.Pings
		}
	}
	if total == 0 {
		t.Fatal("no pings extracted from any player, despite FIELD_NOTES.md recording nonzero ping count")
	}
}
