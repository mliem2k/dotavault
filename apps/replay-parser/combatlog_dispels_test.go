package main

import "testing"

// TestHandleDispel exercises handleDispel directly with synthetic args (same
// pattern as TestHandleNonHeroDeath_Roshan/Tower). Confirmed live against
// match 8921338975's real combat log before writing this: purge_npc (who
// cast the purge ability, e.g. a self-cast Manta Style) is the correct
// attribution target, NOT attacker (the original debuff's caster, who has
// nothing to do with the dispel) and not target (whoever had the debuff,
// which usually but not always equals purge_npc: Guardian Greaves and
// Oracle Purification dispel allies, so they can differ).
func TestHandleDispel(t *testing.T) {
	heroNameToSlot := map[string]int{
		"npc_dota_hero_medusa":     0,
		"npc_dota_hero_windrunner": 128,
	}

	t.Run("self-cast dispel is credited to the caster, with the specific ability purged", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleDispel(players, heroNameToSlot,
			"npc_dota_hero_medusa",      // purge_npc: who cast the dispel
			"item_manta",                // purge_ability: what did the dispelling
			"npc_dota_hero_medusa",      // target: who had the debuff
			"item_medallion_of_courage", // modifier_ability: the specific ability purged
			"modifier_item_medallion_of_courage_armor_reduction", // inflictor: generic wrapper name
			6.93, 1457.3,
		)
		if len(players["0"].DispelsLog) != 1 {
			t.Fatalf("DispelsLog has %d entries, want 1", len(players["0"].DispelsLog))
		}
		ev := players["0"].DispelsLog[0]
		if ev.PurgeAbility != "item_manta" {
			t.Errorf("PurgeAbility = %q, want %q", ev.PurgeAbility, "item_manta")
		}
		if ev.Modifier != "item_medallion_of_courage" {
			t.Errorf("Modifier = %q, want the specific modifier_ability, not the generic inflictor wrapper", ev.Modifier)
		}
		if ev.Target != "npc_dota_hero_medusa" {
			t.Errorf("Target = %q, want %q", ev.Target, "npc_dota_hero_medusa")
		}
		if ev.Duration != 6.93 {
			t.Errorf("Duration = %v, want 6.93", ev.Duration)
		}
	})

	t.Run("falls back to inflictor when modifier_ability is unresolved", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleDispel(players, heroNameToSlot,
			"npc_dota_hero_medusa", "item_manta", "npc_dota_hero_medusa",
			"", "modifier_stunned", 0.83, 1452.1,
		)
		if got := players["0"].DispelsLog[0].Modifier; got != "modifier_stunned" {
			t.Errorf("Modifier = %q, want fallback %q", got, "modifier_stunned")
		}
	})

	t.Run("dispelling an ally's debuff is credited to the caster, not the ally", func(t *testing.T) {
		players := map[string]*PlayerParsed{"128": {}}
		handleDispel(players, heroNameToSlot,
			"npc_dota_hero_windrunner", "oracle_purifying_flames", "npc_dota_hero_medusa",
			"nevermore_shadowraze1", "", 3.0, 500,
		)
		if len(players["128"].DispelsLog) != 1 {
			t.Fatalf("DispelsLog has %d entries, want 1", len(players["128"].DispelsLog))
		}
		if got := players["128"].DispelsLog[0].Target; got != "npc_dota_hero_medusa" {
			t.Errorf("Target = %q, want the ally who was dispelled, %q", got, "npc_dota_hero_medusa")
		}
	})

	t.Run("purge_npc that is not a hero, e.g. a creep, is dropped and not credited to anyone", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleDispel(players, heroNameToSlot,
			"npc_dota_creep_goodguys_melee", "some_ability", "npc_dota_hero_medusa",
			"some_debuff", "", 1.0, 100,
		)
		if len(players["0"].DispelsLog) != 0 {
			t.Errorf("DispelsLog = %v, want empty (purger wasn't a tracked hero)", players["0"].DispelsLog)
		}
	})
}
