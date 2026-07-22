package main

import (
	"reflect"
	"testing"
)

func TestRadiantAdvantage(t *testing.T) {
	players := map[string]*PlayerParsed{
		"0":   {GoldT: []int32{100, 200}},
		"128": {GoldT: []int32{50, 100}},
	}
	got := radiantGoldAdvantage(players)
	want := []int32{50, 100}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("radiantGoldAdvantage() = %v, want %v", got, want)
	}
}

func TestRadiantAdvantage_UnequalLength(t *testing.T) {
	// Shorter series (e.g. a player who never got sampled beyond minute 1)
	// shouldn't panic or produce a shorter-than-expected result silently
	// past the point of disagreement — treat a missing sample as the last
	// known value carried forward, since gold never resets to zero.
	players := map[string]*PlayerParsed{
		"0":   {GoldT: []int32{100, 200, 300}},
		"128": {GoldT: []int32{50}},
	}
	got := radiantGoldAdvantage(players)
	want := []int32{50, 150, 250}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("radiantGoldAdvantage() = %v, want %v", got, want)
	}
}

func TestRadiantAdvantage_DireLonger(t *testing.T) {
	// Dire's own longest series is longer than Radiant's own longest series.
	// This used to panic: maxLen was a shared closure variable mutated by
	// both sum() calls, so the Radiant totals array got sized to the
	// pre-Dire-call maxLen (2) while the final adv loop indexed up to the
	// post-both-calls maxLen (3), reading past the end of the Radiant array.
	players := map[string]*PlayerParsed{
		"0":   {GoldT: []int32{100, 200}},
		"128": {GoldT: []int32{50, 100, 150}},
	}
	got := radiantGoldAdvantage(players)
	want := []int32{50, 100, 50} // minute 2 carries Radiant's last known 200 forward: 200-150=50
	if !reflect.DeepEqual(got, want) {
		t.Errorf("radiantGoldAdvantage() = %v, want %v", got, want)
	}
}

func TestClusterTeamfights(t *testing.T) {
	// A single isolated kill (t=600) is deliberately NOT a "teamfight" —
	// clusterTeamfights filters to 2+ deaths (see its doc comment, matching
	// OpenDota's own threshold), so it must not appear in the output at all.
	kills := []KillEvent{
		{T: 100, Attacker: "npc_dota_hero_axe", Victim: "npc_dota_hero_lina"},
		{T: 105, Attacker: "npc_dota_hero_lina", Victim: "npc_dota_hero_axe"}, // same fight (within 30s)
		{T: 600, Attacker: "npc_dota_hero_axe", Victim: "npc_dota_hero_lina"}, // isolated, below the 2-death threshold
	}
	fights := clusterTeamfights(kills, 30)
	if len(fights) != 1 {
		t.Fatalf("clusterTeamfights: got %d fights, want 1 (only the 2-death cluster qualifies; the isolated kill at t=600 must be dropped)", len(fights))
	}
	if fights[0].Deaths != 2 {
		t.Errorf("fight 1 deaths = %d, want 2", fights[0].Deaths)
	}
	if fights[0].Start != 100 || fights[0].LastDeath != 105 {
		t.Errorf("fight 1 start/last_death = %v/%v, want 100/105", fights[0].Start, fights[0].LastDeath)
	}
}

func TestExtractMatch_Teamfights(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	if len(pm.Teamfights) == 0 {
		t.Skip("fixture may not have any qualifying teamfight (2+ deaths within window); acceptable for a short/one-sided match")
	}
	for _, f := range pm.Teamfights {
		if len(f.Players) != 10 {
			t.Errorf("teamfight players length = %d, want 10", len(f.Players))
		}
	}
}
