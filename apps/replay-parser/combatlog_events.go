package main

// tallyAbilityOrItemUse/tallyMultiKill/tallyKillStreak/tallyCampStack/
// handleNonHeroDeath/firstBloodSlot are called from ExtractMatch's combat-log
// handling (parser.go): the tally* functions from the single
// OnCMsgDOTACombatLogEntry callback, one per combat log type;
// handleNonHeroDeath from the existing DEATH case's early-return branch;
// firstBloodSlot as a post-processing step after p.Start() returns.

func tallyAbilityOrItemUse(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero, key string, isItem bool) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if isItem {
		if p.ItemUses == nil {
			p.ItemUses = map[string]int32{}
		}
		p.ItemUses[key]++
		return
	}
	if p.AbilityUses == nil {
		p.AbilityUses = map[string]int32{}
	}
	p.AbilityUses[key]++
}

func tallyMultiKill(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero string, killCount uint32) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if p.MultiKills == nil {
		p.MultiKills = map[string]int32{}
	}
	p.MultiKills[fmtSlot(int(killCount))]++
}

func tallyKillStreak(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero string, streakCount uint32) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if p.KillStreaks == nil {
		p.KillStreaks = map[string]int32{}
	}
	p.KillStreaks[fmtSlot(int(streakCount))]++
}

func tallyCampStack(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero string) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	players[fmtSlot(slot)].CampsStacked++
}

// handleNonHeroDeath tallies tower and Roshan kills. It's called from the
// existing DEATH case's early-return branch (targets that aren't a
// non-illusion hero), not from TEAM_BUILDING_KILL — FIELD_NOTES.md found
// TEAM_BUILDING_KILL's own is_target_building/building_type fields are
// always 0/false; those live on the paired DEATH entry for the same event
// instead. Roshan is a plain DEATH target too (neither IsTargetHero nor
// IsTargetBuilding), identified by target name.
func handleNonHeroDeath(players map[string]*PlayerParsed, heroNameToSlot map[string]int, attackerHero, targetName string, isTargetBuilding bool) {
	slot, ok := heroNameToSlot[attackerHero]
	if !ok {
		return
	}
	p := players[fmtSlot(slot)]
	if isTargetBuilding {
		p.TowersKilled++
	}
	if targetName == "npc_dota_roshan" {
		p.RoshansKilled++
	}
}

// firstBloodSlot returns whichever match slot got the chronologically
// first kill. FIELD_NOTES.md found the FIRST_BLOOD combat log entry itself
// carries no attacker/target identity (only attacker_team and a
// player-slot-integer assist_players list) — but first blood is, by Dota's
// own rule, always the first hero kill of the match, so the already-
// chronological kills list settles it without needing to correlate
// FIRST_BLOOD with a DEATH entry by timestamp.
func firstBloodSlot(kills []KillEvent, heroNameToSlot map[string]int) (int, bool) {
	if len(kills) == 0 {
		return 0, false
	}
	slot, ok := heroNameToSlot[kills[0].Attacker]
	return slot, ok
}

func strPtr(s string) *string { return &s }
func int32Ptr(v int32) *int32 { return &v }
