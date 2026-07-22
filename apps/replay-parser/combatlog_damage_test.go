package main

import "testing"

func TestExtractMatch_Damage(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	found := false
	foundNullHeroHit := false
	for slot, p := range pm.Players {
		if len(p.Damage) > 0 {
			found = true
		}
		for target, total := range p.Damage {
			if total <= 0 {
				t.Errorf("player %s: damage[%q] = %d, want > 0", slot, target, total)
			}
		}
		if p.HeroHits["null"] > 0 {
			foundNullHeroHit = true
		}
	}
	if !found {
		t.Fatal("no damage extracted from any player")
	}
	// The frontend (apps/web/src/components/match/match_casts.tsx) reads
	// player.hero_hits?.null for plain-attack hits, so a plain autoattack's
	// inflictor (raw combat-log name "dota_unknown") must be normalized to
	// the literal key "null" — every real match has plenty of autoattacks
	// landing on heroes.
	if !foundNullHeroHit {
		t.Fatal(`no player has hero_hits["null"] populated (expected at least one plain-attack hit on a hero)`)
	}
}

// TestHandleDamage_HeroHits exercises handleDamage directly with synthetic
// args (same pattern as TestHandleNonHeroDeath_Roshan/Tower in
// combatlog_events_test.go) for full determinism over the two behaviors the
// fixture alone can't cleanly isolate: key normalization and the hero-only
// gate.
func TestHandleDamage_HeroHits(t *testing.T) {
	heroNameToSlot := map[string]int{
		"npc_dota_hero_axe":  0,
		"npc_dota_hero_lina": 128,
	}

	t.Run("plain attack (dota_unknown) against a hero normalizes to null", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}, "128": {}}
		handleDamage(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_hero_lina", "dota_unknown", 50)
		if got := players["0"].HeroHits["null"]; got != 1 {
			t.Errorf(`HeroHits["null"] = %d, want 1`, got)
		}
		if _, ok := players["0"].HeroHits["dota_unknown"]; ok {
			t.Error(`HeroHits should not contain the raw "dota_unknown" key`)
		}
	})

	t.Run("empty inflictor also normalizes to null", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}, "128": {}}
		handleDamage(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_hero_lina", "", 50)
		if got := players["0"].HeroHits["null"]; got != 1 {
			t.Errorf(`HeroHits["null"] = %d, want 1`, got)
		}
	})

	t.Run("named ability/item inflictor keeps its own key", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}, "128": {}}
		handleDamage(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_hero_lina", "axe_berserkers_call", 50)
		if got := players["0"].HeroHits["axe_berserkers_call"]; got != 1 {
			t.Errorf(`HeroHits["axe_berserkers_call"] = %d, want 1`, got)
		}
	})

	t.Run("damage to a non-hero target does not inflate hero_hits", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleDamage(players, heroNameToSlot, "npc_dota_hero_axe", "npc_dota_creep_goodguys_melee", "dota_unknown", 20)
		if len(players["0"].HeroHits) != 0 {
			t.Errorf("HeroHits = %v, want empty (target was a creep, not a hero)", players["0"].HeroHits)
		}
		// Non-hero damage should still be tracked in the fields that aren't
		// hero-gated — only hero_hits changed behavior in this fix.
		if players["0"].Damage["npc_dota_creep_goodguys_melee"] != 20 {
			t.Errorf("Damage to creep = %d, want 20 (non-hero damage should still be tracked elsewhere)", players["0"].Damage["npc_dota_creep_goodguys_melee"])
		}
	})
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
