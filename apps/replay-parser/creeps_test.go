package main

import "testing"

func TestExtractMatch_Creeps(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	if len(pm.Creeps) == 0 {
		t.Fatal("no creeps extracted")
	}

	seenKind := map[string]bool{}
	for _, c := range pm.Creeps {
		seenKind[c.Kind] = true
		if len(c.Positions) == 0 {
			t.Errorf("creep kind=%s team=%d: no positions", c.Kind, c.Team)
			continue
		}
		switch c.Kind {
		case "lane", "siege":
			if c.Team != 2 && c.Team != 3 {
				t.Errorf("kind=%s: team = %d, want 2 (radiant) or 3 (dire)", c.Kind, c.Team)
			}
		case "neutral", "roshan", "tormentor":
			if c.Team != 4 {
				t.Errorf("kind=%s: team = %d, want 4 (neutral)", c.Kind, c.Team)
			}
		default:
			t.Errorf("unexpected kind %q", c.Kind)
		}
		for i := 1; i < len(c.Positions); i++ {
			if c.Positions[i].T < c.Positions[i-1].T {
				t.Errorf("kind=%s team=%d: positions not time-ordered at %d (%v -> %v)",
					c.Kind, c.Team, i, c.Positions[i-1].T, c.Positions[i].T)
			}
		}
	}

	// This fixture is a real match with both lanes contested and jungle
	// stacking/pulling in play (see FIELD_NOTES.md), so lane and neutral
	// creeps are both expected; siege/roshan/tormentor are opportunistic
	// (whether one spawned/was fought in this specific 11.6-minute Turbo
	// match, not guaranteed) and intentionally not asserted on here.
	if !seenKind["lane"] {
		t.Error("expected at least one lane creep, got none")
	}
	if !seenKind["neutral"] {
		t.Error("expected at least one neutral creep, got none")
	}

	// Output must be deterministic (see trackCreeps' sort) despite the
	// random Go map iteration order it's built from.
	for i := 1; i < len(pm.Creeps); i++ {
		if pm.Creeps[i].Positions[0].T < pm.Creeps[i-1].Positions[0].T {
			t.Errorf("Creeps not sorted by first-seen time at index %d", i)
		}
	}
}

// Manta reuses an entity's index for a new, unrelated entity once the old
// one is destroyed: confirmed empirically against this fixture (234
// creep-class reuse events in this one 11.6-minute Turbo match, frequently
// across Kinds, e.g. a lane creep's index immediately reassigned to a
// neutral camp creep, at gaps often well over a second, which rules out any
// distance/speed heuristic between consecutive samples as a way to detect
// this - the gap before reuse is usually long enough that even a full jump
// across the map stays under a generous speed bound). If trackCreeps didn't
// reset per-index state on EntityOpDeleted, every one of those 234 reused
// indices would silently keep appending to the previous, unrelated creep's
// Positions slice instead of starting a new CreepInstance, so the fixture
// would flatten from 922 distinct instances down to 688 (922-688=234,
// exactly the reuse count). That count is what's directly observable from
// ParsedMatch (CreepInstance deliberately carries no entity id the test
// could pin instead), so this asserts the count stays near the correct,
// unsplit total rather than the collapsed one; verified to fail with
// exactly 688 when the EntityOpDeleted flush is removed.
func TestExtractMatch_CreepsNotSplicedAcrossReusedIndex(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	const minExpected = 800 // correct: 922; spliced (bug): 688
	if len(pm.Creeps) < minExpected {
		t.Errorf("got %d creep instances, want >= %d (a lower count means distinct creeps are being merged when a manta entity index is reused)",
			len(pm.Creeps), minExpected)
	}
}
