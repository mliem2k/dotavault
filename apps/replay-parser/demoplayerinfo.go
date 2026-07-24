package main

import "github.com/dotabuff/manta/dota"

// steamID64Base is the fixed offset between a 64-bit SteamID and Dota's
// 32-bit account_id ("Steam32"), the same public, standard conversion
// OpenDota/Dotabuff/Stratz all use.
const steamID64Base = 76561197960265728

func steamID64ToAccountID(steamID64 uint64) int32 {
	if steamID64 < steamID64Base {
		return 0
	}
	return int32(steamID64 - steamID64Base)
}

// applyDemoPlayerInfo fills in AccountID/PersonaName for each player_slot
// resolved from the replay's own CDemoFileInfo player list — see
// PlayerParsed.AccountID's doc comment in types.go for why this exists.
// heroNameToSlot must already be fully populated (call after p.Start()
// returns), since hero_name -> slot resolution is how each CPlayerInfo
// entry (which carries no player_slot of its own) is matched to a player.
func applyDemoPlayerInfo(
	players map[string]*PlayerParsed,
	heroNameToSlot map[string]int,
	infos []*dota.CGameInfo_CDotaGameInfo_CPlayerInfo,
) {
	for _, info := range infos {
		if info == nil || info.GetIsFakeClient() {
			continue // bots have no real Steam identity
		}
		slot, ok := heroNameToSlot[info.GetHeroName()]
		if !ok {
			continue
		}
		steamID64 := info.GetSteamid()
		if steamID64 == 0 {
			continue
		}
		accountID := steamID64ToAccountID(steamID64)
		p := players[fmtSlot(slot)]
		p.AccountID = &accountID
		if name := info.GetPlayerName(); name != "" {
			p.PersonaName = &name
		}
	}
}
