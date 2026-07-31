package main

import "testing"

// TestHandleHeal exercises handleHeal directly with synthetic args (same
// pattern as TestHandleNonHeroDeath_Roshan/Tower). Confirmed live against
// match 8921338975's real combat log: attacker is the healer, target is the
// recipient (Necrolyte's Death Pulse heals himself and allies with attacker
// always Necrolyte). HealFromRegen entries always carried an empty/
// dota_unknown inflictor in the sample (passive HP regen isn't cast from an
// ability), so regen and lifesteal need their own synthetic bucket keys
// rather than the raw (absent) inflictor name.
func TestHandleHeal(t *testing.T) {
	heroNameToSlot := map[string]int{
		"npc_dota_hero_necrolyte": 0,
		"npc_dota_hero_lina":      128,
	}

	t.Run("named ability heal credits both the healer's dealt and the target's received", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}, "128": {}}
		handleHeal(players, heroNameToSlot, "npc_dota_hero_necrolyte", "npc_dota_hero_lina", "necrolyte_death_pulse", false, false, 70)
		if got := players["0"].HealingDealt["necrolyte_death_pulse"]; got != 70 {
			t.Errorf("healer HealingDealt[necrolyte_death_pulse] = %d, want 70", got)
		}
		if got := players["128"].HealingReceived["necrolyte_death_pulse"]; got != 70 {
			t.Errorf("target HealingReceived[necrolyte_death_pulse] = %d, want 70", got)
		}
	})

	t.Run("self-heal credits the same player on both sides", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleHeal(players, heroNameToSlot, "npc_dota_hero_necrolyte", "npc_dota_hero_necrolyte", "necrolyte_death_pulse", false, false, 27)
		if got := players["0"].HealingDealt["necrolyte_death_pulse"]; got != 27 {
			t.Errorf("HealingDealt[necrolyte_death_pulse] = %d, want 27", got)
		}
		if got := players["0"].HealingReceived["necrolyte_death_pulse"]; got != 27 {
			t.Errorf("HealingReceived[necrolyte_death_pulse] = %d, want 27", got)
		}
	})

	t.Run("passive regen buckets under the synthetic regen key regardless of inflictor", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleHeal(players, heroNameToSlot, "npc_dota_hero_necrolyte", "npc_dota_hero_necrolyte", "dota_unknown", true, false, 34)
		if got := players["0"].HealingDealt["regen"]; got != 34 {
			t.Errorf("HealingDealt[regen] = %d, want 34", got)
		}
		if _, ok := players["0"].HealingDealt["dota_unknown"]; ok {
			t.Error("HealingDealt should not contain the raw dota_unknown key for a regen tick")
		}
	})

	t.Run("lifesteal buckets under the synthetic lifesteal key", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleHeal(players, heroNameToSlot, "npc_dota_hero_necrolyte", "npc_dota_hero_necrolyte", "dota_unknown", false, true, 12)
		if got := players["0"].HealingDealt["lifesteal"]; got != 12 {
			t.Errorf("HealingDealt[lifesteal] = %d, want 12", got)
		}
	})

	t.Run("healer or target not a tracked hero is dropped on that side only", func(t *testing.T) {
		players := map[string]*PlayerParsed{"0": {}}
		handleHeal(players, heroNameToSlot, "npc_dota_hero_necrolyte", "npc_dota_creep_goodguys_melee", "necrolyte_death_pulse", false, false, 20)
		if got := players["0"].HealingDealt["necrolyte_death_pulse"]; got != 20 {
			t.Errorf("HealingDealt[necrolyte_death_pulse] = %d, want 20 (healer side still credited)", got)
		}
	})
}
