package main

import (
	"bytes"
	"compress/bzip2"
	"io"
	"os"
	"testing"
)

func openFixture(t *testing.T) io.Reader {
	t.Helper()
	f, err := os.Open("testdata/fixture.dem.bz2")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	t.Cleanup(func() { f.Close() })
	data, err := io.ReadAll(bzip2.NewReader(f))
	if err != nil {
		t.Fatalf("decompress fixture: %v", err)
	}
	return bytes.NewReader(data)
}

func TestExtractMatch_PositionsAndKills(t *testing.T) {
	pm, err := ExtractMatch(1, openFixture(t))
	if err != nil {
		t.Fatalf("ExtractMatch: %v", err)
	}
	if pm.Duration <= 0 {
		t.Errorf("duration = %v, want > 0", pm.Duration)
	}
	if len(pm.Players) == 0 {
		t.Fatal("no players extracted")
	}
	for slot, p := range pm.Players {
		if len(p.Positions) == 0 {
			t.Errorf("player %s: no positions", slot)
		}
	}
}
