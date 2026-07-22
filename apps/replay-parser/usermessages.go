package main

func recordPing(players map[string]*PlayerParsed, slot int) {
	key := fmtSlot(slot)
	p := players[key]
	if p == nil {
		return
	}
	if p.Pings == nil {
		zero := int32(0)
		p.Pings = &zero
	}
	*p.Pings++
}

// playerIDToMatchSlot converts CDOTA_PlayerResource's global 0-9 player
// index to this parser's 0-4/128-132 match slot convention.
func playerIDToMatchSlot(playerID, team int) int {
	if team == 2 { // Radiant
		return playerID % 5
	}
	return 128 + playerID%5 // Dire
}
