package main

import "testing"

// TestApplyAllyDamageContribution exercises the full flow: a caster (slot
// 4) applies an armor debuff to an enemy (slot 128), and an ally (slot 0)
// lands a physical hit on that enemy during the debuff's window.
func TestApplyAllyDamageContribution(t *testing.T) {
	players := func() map[string]*PlayerParsed {
		return map[string]*PlayerParsed{
			"0":   {}, // ally attacker
			"4":   {}, // debuff caster
			"128": {},
		}
	}

	t.Run("ally's hit during the debuff window is credited to the caster", func(t *testing.T) {
		p := players()
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 0.5},
		}
		hits := []rawPhysicalHit{
			{rawT: 100.2, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 100},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		got, ok := p["4"].AllyDamageContribution["nevermore_dark_lord"]
		if !ok || got != 100 {
			t.Fatalf("AllyDamageContribution[nevermore_dark_lord] = %d (ok=%v), want 100", got, ok)
		}
	})

	t.Run("multiple ally hits during the window accumulate", func(t *testing.T) {
		p := players()
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 2},
		}
		hits := []rawPhysicalHit{
			{rawT: 100.2, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 50},
			{rawT: 101.0, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 30},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		if got := p["4"].AllyDamageContribution["nevermore_dark_lord"]; got != 80 {
			t.Errorf("AllyDamageContribution[nevermore_dark_lord] = %d, want 80 (50+30)", got)
		}
	})

	t.Run("the caster's own hit is never credited as ally contribution", func(t *testing.T) {
		p := players()
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 0.5},
		}
		hits := []rawPhysicalHit{
			{rawT: 100.2, attackerSlot: 4, targetSlot: 128, inflictor: "dota_unknown", value: 100},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		if p["4"].AllyDamageContribution != nil {
			t.Errorf("AllyDamageContribution = %v, want nil (caster's own damage shouldn't count)", p["4"].AllyDamageContribution)
		}
	})

	t.Run("a hit outside the debuff window is not credited", func(t *testing.T) {
		p := players()
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 0.5},
		}
		hits := []rawPhysicalHit{
			{rawT: 105, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 100},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		if p["4"].AllyDamageContribution != nil {
			t.Errorf("AllyDamageContribution = %v, want nil (hit landed after the debuff expired)", p["4"].AllyDamageContribution)
		}
	})

	t.Run("an enemy team hit on the debuffed target is never credited", func(t *testing.T) {
		p := players()
		p["129"] = &PlayerParsed{} // same team as the caster's target, i.e. NOT an ally of slot 4
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 0.5},
		}
		hits := []rawPhysicalHit{
			{rawT: 100.2, attackerSlot: 129, targetSlot: 128, inflictor: "dota_unknown", value: 100},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		if p["4"].AllyDamageContribution != nil {
			t.Errorf("AllyDamageContribution = %v, want nil (attacker is on the debuffed hero's own team)", p["4"].AllyDamageContribution)
		}
	})

	t.Run("a cast with no duration produces no window at all", func(t *testing.T) {
		p := players()
		casts := []rawArmorDebuffCast{
			{rawT: 100, casterSlot: 4, targetSlot: 128, abilityName: "nevermore_dark_lord", duration: 0},
		}
		hits := []rawPhysicalHit{
			{rawT: 100.1, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 100},
		}
		applyAllyDamageContribution(p, casts, hits, 0)

		if p["4"].AllyDamageContribution != nil {
			t.Errorf("AllyDamageContribution = %v, want nil (no duration means no reliable window)", p["4"].AllyDamageContribution)
		}
	})
}
