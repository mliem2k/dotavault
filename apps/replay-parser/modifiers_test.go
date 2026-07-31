package main

import "testing"

func TestExtractMatch_PositionStats(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	var sawSpeed, sawAttackTime, sawDamage bool
	for slot, p := range pm.Players {
		for _, pt := range p.Positions {
			if pt.Speed > 0 {
				sawSpeed = true
			}
			if pt.AttackTime > 0 {
				sawAttackTime = true
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
	var sawActive, sawRemoved, sawKnownItemBuff, sawAura, sawFixedDuration bool
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
			if m.Aura {
				sawAura = true
			}
			if m.Duration > 0 {
				sawFixedDuration = true
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
	if !sawAura {
		t.Error("expected at least one Aura=true event (e.g. modifier_tower_aura_bonus/modifier_fountain_aura_buff, both expected near base/towers in this fixture)")
	}
	if !sawFixedDuration {
		t.Error("expected at least one event with Duration > 0 (e.g. modifier_teleporting, dur=3.0)")
	}
}

// TestSanitizeStatBonus covers a real bug: a cosmetic VFX modifier (a
// Halloween "balloon" effect) reported a stat value of 1449 in a real
// match, orders of magnitude beyond anything a real gameplay modifier
// grants, and that one corrupt sample propagated into the hero's tracked
// totals. These protobuf stat fields are not reserved for the stat their
// name implies, so a bound is the only general defence available.
func TestSanitizeStatBonus(t *testing.T) {
	if got := sanitizeStatBonus(5, 100); got != 5 {
		t.Errorf("sanitizeStatBonus(5, 100) = %d, want 5 (within bounds, unchanged)", got)
	}
	if got := sanitizeStatBonus(1449, 100); got != 0 {
		t.Errorf("sanitizeStatBonus(1449, 100) = %d, want 0 (the real corrupt value that caused this bug)", got)
	}
	if got := sanitizeStatBonus(-1449, 100); got != 0 {
		t.Errorf("sanitizeStatBonus(-1449, 100) = %d, want 0 (corrupt values can be negative too)", got)
	}
	if got := sanitizeStatBonus(100, 100); got != 100 {
		t.Errorf("sanitizeStatBonus(100, 100) = %d, want 100 (exactly at the bound is still valid)", got)
	}
}

// A modifier with a real Duration must expire on its own once that time
// passes, even with no matching Active=false event ever following it — the
// real bug this covers: aura-refresh modifiers (dur=0.5, re-applied on a
// timer for as long as their condition holds) can go a long stretch with
// no explicit removal at all, so a consumer that only tracks explicit
// ACTIVE/REMOVED pairs would see them "stuck on" forever.
func TestActiveBonus_ExpiresOnDurationWithoutRemoval(t *testing.T) {
	active := map[int32]*activeModifier{
		1: {name: "modifier_haste_rune", moveSpeed: 100, appliedAt: 100.0, duration: 0.5},
		2: {name: "modifier_item_magic_wand", moveSpeed: 0, appliedAt: 100.0, duration: 0}, // no fixed duration
	}
	speedBefore, _ := activeBonus(active, 100.4) // still within the 0.5s window
	if speedBefore != 100 {
		t.Errorf("move speed bonus before expiry = %d, want 100", speedBefore)
	}
	speedAfter, _ := activeBonus(active, 100.6) // past appliedAt+duration, no removal ever arrived
	if speedAfter != 0 {
		t.Errorf("move speed bonus after expiry = %d, want 0 (should have expired on its own)", speedAfter)
	}
}
