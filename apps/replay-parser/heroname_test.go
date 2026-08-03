package main

import "testing"

// fakeGet builds an Entity.Get-shaped lookup over a fixed field map.
func fakeGet(fields map[string]any) func(string) any {
	return func(k string) any { return fields[k] }
}

func TestHeroEntityNameIndex(t *testing.T) {
	t.Run("reads the m_nameStringTableIndex spelling", func(t *testing.T) {
		r := newHeroNameIndexReader()
		got, ok := r.read(fakeGet(map[string]any{
			"m_pEntity.m_nameStringTableIndex": int32(412),
		}), nil)
		if !ok || got != 412 {
			t.Fatalf("got (%d, %v), want (412, true)", got, ok)
		}
	})

	// The spelling a replay carries is decided by the game build it was
	// recorded with. Reading only the other one resolves no hero names at
	// all, which does not fail the parse, it just silently empties every
	// combat-log-derived per-player field.
	t.Run("reads the m_nameStringableIndex spelling", func(t *testing.T) {
		r := newHeroNameIndexReader()
		got, ok := r.read(fakeGet(map[string]any{
			"m_pEntity.m_nameStringableIndex": int32(506),
		}), nil)
		if !ok || got != 506 {
			t.Fatalf("got (%d, %v), want (506, true)", got, ok)
		}
	})

	// Guards against a third rename costing another silent parse. Any
	// m_pEntity field whose name is an index into a name string table is
	// accepted, not just the two spellings seen so far.
	t.Run("discovers an unknown spelling from the field map", func(t *testing.T) {
		fields := map[string]any{
			"m_pEntity.m_nameSomethingElseIndex": int32(77),
			"m_iUnitNameIndex":                   int32(126),
			"m_szCurShopEntName":                 "",
		}
		r := newHeroNameIndexReader()
		got, ok := r.read(fakeGet(fields), func() map[string]any { return fields })
		if !ok || got != 77 {
			t.Fatalf("got (%d, %v), want (77, true)", got, ok)
		}
	})

	// m_iUnitNameIndex is an index into a different table (unit names, not
	// EntityNames) and resolves to the wrong string, so the discovery scan
	// must stay scoped to m_pEntity.
	t.Run("does not fall back to a non-m_pEntity name index", func(t *testing.T) {
		fields := map[string]any{"m_iUnitNameIndex": int32(126)}
		r := newHeroNameIndexReader()
		if got, ok := r.read(fakeGet(fields), func() map[string]any { return fields }); ok {
			t.Fatalf("got (%d, true), want ok=false", got)
		}
	})

	t.Run("reports not-found when no name index exists", func(t *testing.T) {
		fields := map[string]any{"m_iCurrentXP": int32(500)}
		r := newHeroNameIndexReader()
		if got, ok := r.read(fakeGet(fields), func() map[string]any { return fields }); ok {
			t.Fatalf("got (%d, true), want ok=false", got)
		}
	})

	// The discovery scan walks every field on the entity, so it must not run
	// on each of the ~200k hero entity updates in a match.
	t.Run("scans the field map at most once", func(t *testing.T) {
		fields := map[string]any{"m_pEntity.m_nameStringableIndex": int32(506)}
		scans := 0
		all := func() map[string]any { scans++; return fields }
		r := newHeroNameIndexReader()
		for range 5 {
			r.read(fakeGet(fields), all)
		}
		if scans != 0 {
			t.Fatalf("scanned %d times, want 0 once a known spelling matched", scans)
		}

		unknown := map[string]any{"m_pEntity.m_nameWhateverIndex": int32(9)}
		scans = 0
		allUnknown := func() map[string]any { scans++; return unknown }
		r2 := newHeroNameIndexReader()
		for range 5 {
			r2.read(fakeGet(unknown), allUnknown)
		}
		if scans != 1 {
			t.Fatalf("scanned %d times, want exactly 1", scans)
		}
	})
}
