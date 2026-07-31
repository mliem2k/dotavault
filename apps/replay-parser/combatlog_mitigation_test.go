package main

import "testing"

func TestPhysicalArmorReductionPct(t *testing.T) {
	// dotabuff.com/blog/2018-11-30-understanding-720-armor-changes cites 0
	// to 10 armor reducing physical damage by ~37%, and 10 to 20 adding
	// another ~16 percentage points.
	if got := physicalArmorReductionPct(10); got < 0.36 || got > 0.39 {
		t.Errorf("physicalArmorReductionPct(10) = %v, want ~0.375", got)
	}
	if got := physicalArmorReductionPct(20); got < 0.53 || got > 0.56 {
		t.Errorf("physicalArmorReductionPct(20) = %v, want ~0.545", got)
	}
	if got := physicalArmorReductionPct(0); got != 0 {
		t.Errorf("physicalArmorReductionPct(0) = %v, want 0", got)
	}
	if got := physicalArmorReductionPct(-10); got != 0 {
		t.Errorf("physicalArmorReductionPct(-10) = %v, want 0 (negative armor amplifies, never mitigates)", got)
	}
	// The raw formula asymptotically exceeds 1.0 well past any realistic
	// in-game armor total (~225+), which would flip the sign of anything
	// dividing by (1 - pct) downstream. Confirmed clamped instead.
	if got := physicalArmorReductionPct(1000); got != 0.95 {
		t.Errorf("physicalArmorReductionPct(1000) = %v, want 0.95 (clamped)", got)
	}
}

func TestPhysicalMitigation(t *testing.T) {
	// At 10 armor (~37.5% reduction), a landed hit of 100 means roughly 160
	// raw damage was attempted, so ~60 was mitigated.
	got := physicalMitigation(100, 10)
	if got < 55 || got > 65 {
		t.Errorf("physicalMitigation(100, 10) = %d, want ~60", got)
	}
	if got := physicalMitigation(100, 0); got != 0 {
		t.Errorf("physicalMitigation(100, 0) = %d, want 0 (no armor, nothing mitigated)", got)
	}
	if got := physicalMitigation(100, -10); got != 0 {
		t.Errorf("physicalMitigation(100, -10) = %d, want 0 (negative armor, nothing mitigated)", got)
	}
}

func TestArmorAt(t *testing.T) {
	positions := []PositionPoint{
		{T: 0, Armor: 2},
		{T: 100, Armor: 5},
		{T: 200, Armor: 8},
	}

	t.Run("before every sample falls back to the earliest", func(t *testing.T) {
		got, ok := armorAt(positions, -50)
		if !ok || got != 2 {
			t.Errorf("armorAt(-50) = (%v, %v), want (2, true)", got, ok)
		}
	})
	t.Run("exact match on a sample", func(t *testing.T) {
		got, ok := armorAt(positions, 100)
		if !ok || got != 5 {
			t.Errorf("armorAt(100) = (%v, %v), want (5, true)", got, ok)
		}
	})
	t.Run("between samples uses the nearest one at or before", func(t *testing.T) {
		got, ok := armorAt(positions, 150)
		if !ok || got != 5 {
			t.Errorf("armorAt(150) = (%v, %v), want (5, true)", got, ok)
		}
	})
	t.Run("after every sample uses the latest", func(t *testing.T) {
		got, ok := armorAt(positions, 9999)
		if !ok || got != 8 {
			t.Errorf("armorAt(9999) = (%v, %v), want (8, true)", got, ok)
		}
	})
	t.Run("no samples at all", func(t *testing.T) {
		_, ok := armorAt(nil, 50)
		if ok {
			t.Error("armorAt(nil) ok = true, want false")
		}
	})
}

func TestApplyPhysicalMitigation(t *testing.T) {
	players := map[string]*PlayerParsed{
		"0":   {Positions: nil}, // attacker: no positions needed
		"128": {Positions: []PositionPoint{{T: 0, Armor: 10}}},
	}
	hits := []rawPhysicalHit{
		{rawT: 100, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 100},
	}
	applyPhysicalMitigation(players, hits, 0)

	got, ok := players["0"].DamageMitigated["dota_unknown"]
	if !ok {
		t.Fatal("DamageMitigated[\"dota_unknown\"] not set")
	}
	if got < 55 || got > 65 {
		t.Errorf("DamageMitigated[dota_unknown] = %d, want ~60 (armor 10 on the target)", got)
	}
}

func TestApplyPhysicalMitigation_ZeroArmorSkipsEntirely(t *testing.T) {
	players := map[string]*PlayerParsed{
		"0":   {},
		"128": {Positions: []PositionPoint{{T: 0, Armor: 0}}},
	}
	hits := []rawPhysicalHit{
		{rawT: 100, attackerSlot: 0, targetSlot: 128, inflictor: "dota_unknown", value: 100},
	}
	applyPhysicalMitigation(players, hits, 0)

	if players["0"].DamageMitigated != nil {
		t.Errorf("DamageMitigated = %v, want nil (zero armor mitigates nothing, map should stay unallocated)", players["0"].DamageMitigated)
	}
}
