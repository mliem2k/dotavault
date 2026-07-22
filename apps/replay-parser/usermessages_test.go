package main

import "testing"

func TestExtractMatch_Pings(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	total := int32(0)
	for _, p := range pm.Players {
		if p.Pings != nil {
			total += *p.Pings
		}
	}
	if total == 0 {
		t.Fatal("no pings extracted from any player, despite FIELD_NOTES.md recording nonzero ping count")
	}
}

func TestExtractMatch_Chat(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	// FIELD_NOTES.md recorded exactly 3 chatwheel + 3 chatmessage events in
	// this fixture — assert the precise count, not just nonzero, since the
	// ground truth is already known.
	if len(pm.Chat) != 6 {
		t.Fatalf("len(pm.Chat) = %d, want 6 (3 chatwheel + 3 chatmessage, per FIELD_NOTES.md)", len(pm.Chat))
	}
	for i, c := range pm.Chat {
		if c.Type == "" {
			t.Errorf("chat[%d]: empty type", i)
		}
		if c.Type != "chatwheel" && c.Type != "chat" {
			t.Errorf("chat[%d]: unexpected type %q", i, c.Type)
		}
	}
}
