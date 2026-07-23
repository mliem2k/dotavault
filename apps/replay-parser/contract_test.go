package main

import (
	"encoding/json"
	"testing"
)

func TestParsedMatch_JSONContract(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	raw, err := json.Marshal(pm)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	wantTopLevel := []string{"match_id", "duration", "players", "kills", "teamfights", "objectives", "chat", "radiant_gold_adv", "radiant_xp_adv"}
	for _, key := range wantTopLevel {
		if _, ok := generic[key]; !ok {
			t.Errorf("ParsedMatch JSON missing top-level key %q", key)
		}
	}

	players, ok := generic["players"].(map[string]any)
	if !ok || len(players) == 0 {
		t.Fatal("players map missing or empty")
	}
	var samplePlayer map[string]any
	for _, v := range players {
		samplePlayer = v.(map[string]any)
		break
	}
	wantPlayerKeys := []string{
		"positions", "kills_log", "purchase", "purchase_log", "gold_t", "lh_t", "dn_t", "xp_t",
		"obs_log", "sen_log", "obs_left_log", "sen_left_log", "damage", "damage_taken",
		"damage_inflictor", "damage_targets", "killed", "gold_reasons", "xp_reasons",
		"camps_stacked", "rune_pickups", "buyback_count", "total_gold", "runes_log",
		"buyback_log", "lane_pos", "ability_uses", "item_uses", "hero_hits", "multi_kills",
		"kill_streaks", "towers_killed", "roshans_killed", "firstblood_claimed", "modifiers",
	}
	for _, key := range wantPlayerKeys {
		if _, ok := samplePlayer[key]; !ok {
			t.Errorf("PlayerParsed JSON missing key %q", key)
		}
	}
}
