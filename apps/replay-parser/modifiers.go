package main

import (
	"strings"

	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
)

// activeModifier is the live state of one occupied buff-table slot on a
// hero: the Index field on CDOTAModifierBuffTableEntry is a fixed slot
// per entity, reused across a match, so a REMOVED event for the same
// Index correctly clears exactly the modifier that occupied it rather
// than needing to match by name.
type activeModifier struct {
	name        string
	moveSpeed   int32
	attackSpeed int32
	armor       int32
}

// rawModifierEvent buffers a lifecycle transition by raw demo-clock
// second, same "buffer now, convert after" reason as rawKills/
// preGamePositions in parser.go: gameStartTime (the 0:00 anchor) isn't
// known yet for any event that arrives during pregame.
type rawModifierEvent struct {
	rawT   float64
	slot   int
	name   string
	active bool
	stacks int32
}

// trackModifiers registers the OnModifierTableEntry callback. It keeps
// activeBySlot current (for the position sampler's live stat totals) and
// appends every transition to rawEvents (for the final Modifiers log,
// shifted into match-time once gameStartTime is known, same pass that
// shifts preGamePositions).
//
// Not every ModifierTableEntry belongs to a hero — most are courier/
// tower/fountain/building/Roshan modifiers — so entries are dropped
// unless Parent resolves to a real CDOTA_Unit_Hero_* entity via
// p.FindEntityByHandle (which verifies the handle's serial number, unlike
// a bare index mask, so a stale handle pointing at a since-recycled index
// slot is correctly rejected rather than silently misattributed).
//
// Known gap: a Monkey King Primal Split / Arc Warden Tempest Double decoy
// resolves to the same player_slot as the real hero (same m_iPlayerID/
// m_iTeamNum, matching the existing decoy-contamination note on the hero
// OnEntity callback above), so a decoy's own modifiers can appear
// attributed to that slot alongside the real hero's. Not filtered here,
// same "document, don't over-engineer for a rare case" call as the
// existing sentry-ward and buyback-attribution gaps.
func trackModifiers(
	p *manta.Parser,
	activeBySlot map[int]map[int32]*activeModifier,
	rawEvents *[]rawModifierEvent,
	rawT func() float64,
) {
	p.OnModifierTableEntry(func(m *dota.CDOTAModifierBuffTableEntry) error {
		parent := p.FindEntityByHandle(uint64(m.GetParent()))
		if parent == nil || !strings.HasPrefix(parent.GetClassName(), "CDOTA_Unit_Hero_") {
			return nil
		}
		playerID, ok := parent.Get("m_iPlayerID").(uint32)
		if !ok {
			return nil
		}
		teamNum, ok := parent.Get("m_iTeamNum").(uint64)
		if !ok {
			return nil
		}
		slot, ok := playerSlot(playerID, teamNum)
		if !ok {
			return nil
		}
		name, ok := p.LookupStringByIndex("ModifierNames", m.GetModifierClass())
		if !ok {
			return nil
		}

		if activeBySlot[slot] == nil {
			activeBySlot[slot] = map[int32]*activeModifier{}
		}
		idx := m.GetIndex()

		if m.GetEntryType() == dota.DOTA_MODIFIER_ENTRY_TYPE_DOTA_MODIFIER_ENTRY_TYPE_REMOVED {
			delete(activeBySlot[slot], idx)
			*rawEvents = append(*rawEvents, rawModifierEvent{rawT: rawT(), slot: slot, name: name, active: false})
			return nil
		}

		activeBySlot[slot][idx] = &activeModifier{
			name:        name,
			moveSpeed:   m.GetMovementSpeed(),
			attackSpeed: m.GetAttackSpeed(),
			armor:       m.GetArmor(),
		}
		*rawEvents = append(*rawEvents, rawModifierEvent{
			rawT: rawT(), slot: slot, name: name, active: true, stacks: m.GetStackCount(),
		})
		return nil
	})
}

// activeBonus sums every currently-active modifier's stat contribution for
// one hero, consumed by the position sampler to compute live Speed/
// AttackTime/Armor (see PositionPoint's doc comment for why these can't
// just be read off the hero entity directly).
func activeBonus(active map[int32]*activeModifier) (moveSpeed, attackSpeed, armor int32) {
	for _, m := range active {
		moveSpeed += m.moveSpeed
		attackSpeed += m.attackSpeed
		armor += m.armor
	}
	return
}
