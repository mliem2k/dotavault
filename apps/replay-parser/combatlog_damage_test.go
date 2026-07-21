package main

import "testing"

func TestExtractMatch_Damage(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for slot, p := range pm.Players {
		if len(p.Damage) > 0 {
			found = true
		}
		for target, total := range p.Damage {
			if total <= 0 {
				t.Errorf("player %s: damage[%q] = %d, want > 0", slot, target, total)
			}
		}
	}
	if !found {
		t.Fatal("no damage extracted from any player")
	}
}

func TestExtractMatch_GoldReasons(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for _, p := range pm.Players {
		if len(p.GoldReasons) > 0 {
			found = true
		}
	}
	if !found {
		t.Fatal("no gold_reasons extracted from any player")
	}
}

func TestExtractMatch_KillsLogAndKilled(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	totalKillsLog, totalKilled := 0, 0
	for _, p := range pm.Players {
		totalKillsLog += len(p.KillsLog)
		for _, n := range p.Killed {
			totalKilled += int(n)
		}
	}
	if totalKillsLog == 0 || totalKilled == 0 {
		t.Fatalf("kills_log entries=%d killed total=%d, want both > 0", totalKillsLog, totalKilled)
	}
	if totalKillsLog != totalKilled {
		t.Errorf("sum(kills_log lengths)=%d != sum(killed values)=%d, should describe the same kills", totalKillsLog, totalKilled)
	}
}
