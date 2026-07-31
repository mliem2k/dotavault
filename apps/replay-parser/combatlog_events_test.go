package main

import "testing"

func TestExtractMatch_AbilityAndItemUses(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	for _, p := range pm.Players {
		if len(p.AbilityUses) > 0 {
			found = true
		}
	}
	if !found {
		t.Fatal("no ability_uses extracted from any player")
	}
}

func TestExtractMatch_TowersAndFirstblood(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	totalTowers, totalFirstblood := 0, 0
	for _, p := range pm.Players {
		totalTowers += int(p.TowersKilled)
		totalFirstblood += int(p.FirstbloodClaimed)
	}
	if totalTowers == 0 {
		t.Error("no towers_killed extracted (every real match destroys at least one tower)")
	}
	if totalFirstblood != 1 {
		t.Errorf("firstblood_claimed total = %d, want exactly 1 (one hero gets first blood per match)", totalFirstblood)
	}
}

func TestExtractMatch_Objectives(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	if len(pm.Objectives) == 0 {
		t.Fatal("no objectives extracted")
	}
}

// Roshan kills and neutral camp stacks didn't occur in the fixture (an
// 11.6-minute Turbo match) — FIELD_NOTES.md confirms zero occurrences of
// each. These call the plain tally functions directly with synthetic
// arguments rather than relying on fixture coverage that doesn't exist.

func TestHandleNonHeroDeath_Roshan(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	handleNonHeroDeath(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_roshan", false)
	if players["0"].RoshansKilled != 1 {
		t.Errorf("RoshansKilled = %d, want 1", players["0"].RoshansKilled)
	}
	if players["0"].TowersKilled != 0 {
		t.Errorf("TowersKilled = %d, want 0 (this was a Roshan kill, not a building)", players["0"].TowersKilled)
	}
}

func TestHandleNonHeroDeath_Tower(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	handleNonHeroDeath(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_goodguys_tower1_top", true)
	if players["0"].TowersKilled != 1 {
		t.Errorf("TowersKilled = %d, want 1", players["0"].TowersKilled)
	}
}

func TestHandleNonHeroDeath_ObserverWard(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	handleNonHeroDeath(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_observer_wards", false)
	if players["0"].ObserverKills != 1 {
		t.Errorf("ObserverKills = %d, want 1", players["0"].ObserverKills)
	}
	if players["0"].SentryKills != 0 {
		t.Errorf("SentryKills = %d, want 0 (this was an observer ward kill, not a sentry)", players["0"].SentryKills)
	}
}

func TestHandleNonHeroDeath_SentryWard(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	handleNonHeroDeath(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_sentry_wards", false)
	if players["0"].SentryKills != 1 {
		t.Errorf("SentryKills = %d, want 1", players["0"].SentryKills)
	}
	if players["0"].ObserverKills != 0 {
		t.Errorf("ObserverKills = %d, want 0 (this was a sentry ward kill, not an observer)", players["0"].ObserverKills)
	}
}

// A ward's own self-attack on natural expiry (attacker equals target, so it
// never resolves through heroNameToSlot) must not be credited to anyone.
// Confirmed live against match 8921338975's real combat log: every
// natural-expiry ward death has npc_dota_observer_wards/npc_dota_sentry_wards
// as its own attacker, distinct from an enemy hero's kill.
func TestHandleNonHeroDeath_WardSelfExpiryNotCredited(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	handleNonHeroDeath(players, heroNameToSlot, "npc_dota_observer_wards", "npc_dota_observer_wards", false)
	if players["0"].ObserverKills != 0 {
		t.Errorf("ObserverKills = %d, want 0 (natural expiry, not an enemy kill)", players["0"].ObserverKills)
	}
}

func TestTallyCampStack(t *testing.T) {
	players := map[string]*PlayerParsed{"0": {}}
	heroNameToSlot := map[string]int{"npc_dota_hero_axe": 0}
	tallyCampStack(players, heroNameToSlot, "npc_dota_hero_axe")
	if players["0"].CampsStacked != 1 {
		t.Errorf("CampsStacked = %d, want 1", players["0"].CampsStacked)
	}
}

func TestFirstBloodSlot(t *testing.T) {
	kills := []KillEvent{
		{T: 177.5, Attacker: "npc_dota_hero_enchantress", Victim: "npc_dota_hero_slark"},
		{T: 300, Attacker: "npc_dota_hero_slark", Victim: "npc_dota_hero_enchantress"},
	}
	heroNameToSlot := map[string]int{"npc_dota_hero_enchantress": 0, "npc_dota_hero_slark": 128}
	slot, ok := firstBloodSlot(kills, heroNameToSlot)
	if !ok || slot != 0 {
		t.Errorf("firstBloodSlot = (%d, %v), want (0, true)", slot, ok)
	}
}
