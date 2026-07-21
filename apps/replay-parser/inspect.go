// apps/replay-parser/inspect.go

// runInspect is a permanent debugging aid for adding new extraction fields:
// point it at a local .dem (bz2 or raw) via INSPECT_FILE and it prints
// distinct entity class names matching a substring, CDOTA_PlayerResource's
// full field map, and counts of user-command messages (pings/chat), so a
// future engineer doesn't have to guess field paths from documentation that
// doesn't match this game version.
package main

import (
	"compress/bzip2"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
)

func runInspect(path string) {
	if path == "" {
		fmt.Fprintln(os.Stderr, "usage: INSPECT_FILE=testdata/fixture.dem.bz2 replay-parser -inspect")
		os.Exit(2)
	}
	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()

	var r = io.Reader(f)
	if strings.HasSuffix(path, ".bz2") {
		r = bzip2.NewReader(f)
	}

	p, err := manta.NewStreamParser(r)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	seenClasses := map[string]bool{}
	combatLogSamples := map[dota.DOTA_COMBATLOG_TYPES]int{}
	const sampleLimit = 5

	clName := func(idx uint32) string {
		s, _ := p.LookupStringByIndex("CombatLogNames", int32(idx))
		return s
	}

	p.Callbacks.OnCMsgDOTACombatLogEntry(func(m *dota.CMsgDOTACombatLogEntry) error {
		t := m.GetType()
		if combatLogSamples[t] < sampleLimit {
			combatLogSamples[t]++
			fmt.Printf("combatlog type=%s attacker=%q target=%q inflictor=%q value=%d health=%d gold_reason=%d xp_reason=%d rune_type=%d neutral_camp_type=%d stack_count=%d obs_wards_placed=%d is_target_building=%v building_type=%d\n",
				t, clName(m.GetAttackerName()), clName(m.GetTargetName()), clName(m.GetInflictorName()),
				m.GetValue(), m.GetHealth(), m.GetGoldReason(), m.GetXpReason(), m.GetRuneType(),
				m.GetNeutralCampType(), m.GetStackCount(), m.GetObsWardsPlaced(), m.GetIsTargetBuilding(), m.GetBuildingType())
		}
		return nil
	})

	// CDOTAUserMsg_Ping is a network-latency diagnostic (Ping/Loss fields),
	// not a gameplay ping — counted separately so it doesn't get confused
	// with CDOTAUserMsg_LocationPing, the actual minimap ping.
	netPingCount, locationPingCount, chatWheelCount, chatMsgCount := 0, 0, 0, 0
	p.Callbacks.OnCDOTAUserMsg_Ping(func(*dota.CDOTAUserMsg_Ping) error { netPingCount++; return nil })
	p.Callbacks.OnCDOTAUserMsg_LocationPing(func(*dota.CDOTAUserMsg_LocationPing) error { locationPingCount++; return nil })
	p.Callbacks.OnCDOTAUserMsg_ChatWheel(func(*dota.CDOTAUserMsg_ChatWheel) error { chatWheelCount++; return nil })
	p.Callbacks.OnCDOTAUserMsg_ChatMessage(func(*dota.CDOTAUserMsg_ChatMessage) error { chatMsgCount++; return nil })

	p.OnEntity(func(e *manta.Entity, op manta.EntityOp) error {
		cn := e.GetClassName()
		if op.Flag(manta.EntityOpCreated) && !seenClasses[cn] {
			seenClasses[cn] = true
			if strings.Contains(strings.ToLower(cn), "ward") {
				fmt.Println("ward class:", cn)
			}
		}
		// Economy fields (gold/last hits/denies/net worth) turned out NOT to
		// live on CDOTA_PlayerResource in this game version — see
		// FIELD_NOTES.md — they're on the per-team CDOTA_DataRadiant /
		// CDOTA_DataDire entities (m_vecDataTeam.<0-4>.*) and, for a flat
		// cross-team view, CDOTA_DataSpectator.m_iNetWorth.<slot>. All three
		// are scanned here so this stays a useful "guess the field path"
		// tool instead of only ever matching the class the brief assumed.
		if (cn == "CDOTA_PlayerResource" || cn == "CDOTA_DataRadiant" || cn == "CDOTA_DataDire" || cn == "CDOTA_DataSpectator") && op.Flag(manta.EntityOpCreated) {
			for k := range e.Map() {
				lower := strings.ToLower(k)
				if strings.Contains(lower, "gold") || strings.Contains(lower, "lasthit") ||
					strings.Contains(lower, "deny") || strings.Contains(lower, "xp") || strings.Contains(lower, "networth") {
					fmt.Println(cn+" field:", k)
				}
			}
		}
		return nil
	})

	_ = p.Start()
	fmt.Printf("\nuser-command counts: location_ping=%d net_ping(irrelevant)=%d chatwheel=%d chatmessage=%d\n", locationPingCount, netPingCount, chatWheelCount, chatMsgCount)
}
