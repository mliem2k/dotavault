package main

func teamAdvantage(players map[string]*PlayerParsed, extract func(*PlayerParsed) []int32) []int32 {
	radiantSlots := []string{"0", "1", "2", "3", "4"}
	direSlots := []string{"128", "129", "130", "131", "132"}

	maxLen := 0
	sum := func(slots []string) []int32 {
		var series [][]int32
		for _, s := range slots {
			if p, ok := players[s]; ok {
				v := extract(p)
				series = append(series, v)
				if len(v) > maxLen {
					maxLen = len(v)
				}
			}
		}
		totals := make([]int32, maxLen)
		for _, v := range series {
			for i := 0; i < maxLen; i++ {
				if i < len(v) {
					totals[i] += v[i]
				} else if len(v) > 0 {
					totals[i] += v[len(v)-1] // carry the last known value forward
				}
			}
		}
		return totals
	}

	radiant := sum(radiantSlots)
	dire := sum(direSlots)
	adv := make([]int32, maxLen)
	for i := 0; i < maxLen; i++ {
		adv[i] = radiant[i] - dire[i]
	}
	return adv
}

func radiantGoldAdvantage(players map[string]*PlayerParsed) []int32 {
	return teamAdvantage(players, func(p *PlayerParsed) []int32 { return p.GoldT })
}

func radiantXpAdvantage(players map[string]*PlayerParsed) []int32 {
	return teamAdvantage(players, func(p *PlayerParsed) []int32 { return p.XpT })
}

// clusterTeamfights groups kills into fights: any two deaths within
// windowSeconds of each other belong to the same fight. This is the same
// heuristic OpenDota's own open-source parser (github.com/odota/parser)
// documents publicly for teamfight detection.
func clusterTeamfights(kills []KillEvent, windowSeconds float64) []Teamfight {
	if len(kills) == 0 {
		return nil
	}
	var fights []Teamfight
	cur := Teamfight{Start: kills[0].T, LastDeath: kills[0].T, Deaths: 1}
	for i := 1; i < len(kills); i++ {
		if kills[i].T-cur.LastDeath <= windowSeconds {
			cur.LastDeath = kills[i].T
			cur.Deaths++
			continue
		}
		cur.End = cur.LastDeath
		fights = append(fights, cur)
		cur = Teamfight{Start: kills[i].T, LastDeath: kills[i].T, Deaths: 1}
	}
	cur.End = cur.LastDeath
	fights = append(fights, cur)

	// Only fights with 2+ deaths count as teamfights (a single isolated
	// kill isn't a "fight"), matching OpenDota's own threshold.
	var qualifying []Teamfight
	for _, f := range fights {
		if f.Deaths >= 2 {
			qualifying = append(qualifying, f)
		}
	}
	return qualifying
}

// buildTeamfightPlayers fills the fixed 10-entry (Radiant 0-4, Dire
// 128-132) per-fight player stats slice.
func buildTeamfightPlayers(players map[string]*PlayerParsed, fight Teamfight, kills []KillEvent) []TeamfightPlayerStats {
	slots := []string{"0", "1", "2", "3", "4", "128", "129", "130", "131", "132"}
	stats := make([]TeamfightPlayerStats, len(slots))
	for i := range stats {
		stats[i] = TeamfightPlayerStats{
			DeathsPos:   map[string]map[string]int32{},
			AbilityUses: map[string]int32{},
			ItemUses:    map[string]int32{},
			Killed:      map[string]int32{},
		}
	}
	return stats // per-fight death/damage attribution is a refinement Plan 2 can extend once basic teamfight boundaries are validated against real matches
}
