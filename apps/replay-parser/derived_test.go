package main

import (
	"reflect"
	"testing"
)

func TestRadiantAdvantage(t *testing.T) {
	players := map[string]*PlayerParsed{
		"0":   {GoldT: []int32{100, 200}},
		"128": {GoldT: []int32{50, 100}},
	}
	got := radiantGoldAdvantage(players)
	want := []int32{50, 100}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("radiantGoldAdvantage() = %v, want %v", got, want)
	}
}

func TestRadiantAdvantage_UnequalLength(t *testing.T) {
	// Shorter series (e.g. a player who never got sampled beyond minute 1)
	// shouldn't panic or produce a shorter-than-expected result silently
	// past the point of disagreement — treat a missing sample as the last
	// known value carried forward, since gold never resets to zero.
	players := map[string]*PlayerParsed{
		"0":   {GoldT: []int32{100, 200, 300}},
		"128": {GoldT: []int32{50}},
	}
	got := radiantGoldAdvantage(players)
	want := []int32{50, 150, 250}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("radiantGoldAdvantage() = %v, want %v", got, want)
	}
}
