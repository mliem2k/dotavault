package main

import "testing"

func TestExtractMatch_DemoPlayerInfo(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	resolved := 0
	for slot, p := range pm.Players {
		if p.AccountID == nil {
			continue
		}
		resolved++
		if *p.AccountID <= 0 {
			t.Errorf("player %s: account_id = %d, want > 0", slot, *p.AccountID)
		}
		if p.PersonaName == nil || *p.PersonaName == "" {
			t.Errorf("player %s: account_id resolved but personaname missing", slot)
		}
	}
	if resolved != 10 {
		t.Errorf("resolved %d players, want 10 (this fixture has no bots)", resolved)
	}
}

func TestSteamID64ToAccountID(t *testing.T) {
	// A known-good pair verified against this fixture: 76561199181866316 is
	// the enchantress player's real steamid64.
	got := steamID64ToAccountID(76561199181866316)
	want := int32(1221600588)
	if got != want {
		t.Errorf("steamID64ToAccountID(...) = %d, want %d", got, want)
	}
	if got := steamID64ToAccountID(0); got != 0 {
		t.Errorf("steamID64ToAccountID(0) = %d, want 0", got)
	}
}
