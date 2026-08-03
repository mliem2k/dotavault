package main

import "strings"

// knownHeroNameIndexKeys are the field paths Valve's send tables have used
// for a hero entity's index into the EntityNames string table. Which one a
// replay carries is decided by the game build it was recorded with, and a
// replay never carries both.
//
// Getting this wrong is close to invisible, which is why the discovery
// fallback below exists. Failing to resolve the index does not fail the
// parse: everything sourced from entity data (positions, gold/xp/lh series,
// wards, lane positions) still works, because those key off the player slot
// this parser already derived. What breaks is every combat-log-derived
// per-player field (purchases, damage, damage_targets, kills_log, killed,
// healing, gold/xp reasons, runes, ability and item uses, stuns, dispels),
// because the combat log identifies units by internal name and needs this
// mapping to attribute them to a slot. The parse then completes, reports no
// error, and emits a match whose per-player combat data is uniformly empty.
var knownHeroNameIndexKeys = [...]string{
	"m_pEntity.m_nameStringTableIndex",
	"m_pEntity.m_nameStringableIndex",
}

// heroNameIndexReader resolves a hero entity's EntityNames index across game
// builds that spell the field differently. It caches whichever key a replay
// actually uses, so the discovery scan runs at most once per parse rather
// than on each of the roughly 200k hero entity updates in a match.
type heroNameIndexReader struct {
	key     string
	scanned bool
}

func newHeroNameIndexReader() *heroNameIndexReader { return &heroNameIndexReader{} }

// read returns the entity's EntityNames string-table index. get is the
// entity's own field lookup; allFields returns its full field map and is
// only called if none of the known spellings match, so it may be nil when
// the caller has no cheap way to enumerate fields.
func (r *heroNameIndexReader) read(get func(string) any, allFields func() map[string]any) (int32, bool) {
	if r.key != "" {
		idx, ok := get(r.key).(int32)
		return idx, ok
	}
	for _, k := range knownHeroNameIndexKeys {
		if idx, ok := get(k).(int32); ok {
			r.key = k
			return idx, true
		}
	}
	// Neither known spelling is present, so this is a build that renamed the
	// field again. Find it by shape instead of by name so the next rename
	// costs a slower first entity rather than another silently empty parse.
	if r.scanned || allFields == nil {
		return 0, false
	}
	r.scanned = true
	for k, v := range allFields() {
		idx, ok := v.(int32)
		if !ok || !isHeroNameIndexKey(k) {
			continue
		}
		r.key = k
		return idx, true
	}
	return 0, false
}

// isHeroNameIndexKey matches a name-table index living on the entity's own
// m_pEntity block. Both the prefix and the "name" test matter: a hero also
// carries m_iUnitNameIndex, which indexes a different table and resolves to
// the wrong string through EntityNames, and m_pEntity itself is a small
// block (the observed builds expose the name index and little else), so
// matching on shape within it is specific enough without pinning the exact
// spelling the next build might use.
func isHeroNameIndexKey(k string) bool {
	return strings.HasPrefix(k, "m_pEntity.") &&
		strings.HasSuffix(k, "Index") &&
		strings.Contains(strings.ToLower(k), "name")
}
