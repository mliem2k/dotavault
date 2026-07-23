package main

import "testing"

func TestExtractMatch_PositionStats(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	var sawSpeed, sawAttackTime, sawArmor, sawDamage bool
	for slot, p := range pm.Players {
		for _, pt := range p.Positions {
			if pt.Speed > 0 {
				sawSpeed = true
			}
			if pt.AttackTime > 0 {
				sawAttackTime = true
			}
			if pt.Armor > 0 {
				sawArmor = true
			}
			if pt.DamageMax > 0 {
				sawDamage = true
			}
			if pt.DamageMin > pt.DamageMax {
				t.Errorf("player %s: DamageMin (%d) > DamageMax (%d) at t=%.1f", slot, pt.DamageMin, pt.DamageMax, pt.T)
			}
		}
	}
	if !sawSpeed {
		t.Error("no position sample had Speed > 0 across the whole match")
	}
	if !sawAttackTime {
		t.Error("no position sample had AttackTime > 0 across the whole match")
	}
	if !sawArmor {
		t.Error("no position sample had Armor > 0 across the whole match")
	}
	if !sawDamage {
		t.Error("no position sample had DamageMax > 0 across the whole match")
	}
}

func TestExtractMatch_Modifiers(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	var total int
	var sawActive, sawRemoved, sawKnownItemBuff bool
	for _, p := range pm.Players {
		for _, m := range p.Modifiers {
			total++
			if m.Name == "" {
				t.Errorf("modifier event has an empty Name (t=%.1f)", m.T)
			}
			if m.Active {
				sawActive = true
			} else {
				sawRemoved = true
			}
			if m.Name == "modifier_item_magic_wand" || m.Name == "modifier_item_magic_stick_hero" {
				sawKnownItemBuff = true
			}
		}
	}
	if total == 0 {
		t.Fatal("no modifier events extracted for any player")
	}
	if !sawActive {
		t.Error("no modifier event had Active=true")
	}
	if !sawRemoved {
		t.Error("no modifier event had Active=false (removed)")
	}
	if !sawKnownItemBuff {
		t.Error("expected at least one modifier_item_magic_wand/modifier_item_magic_stick_hero event in the fixture (both items are purchased in this match)")
	}
}
