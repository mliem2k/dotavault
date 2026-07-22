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
