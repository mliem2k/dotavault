package main

// sampleMinute appends one per-player sample to that minute's series if it
// hasn't been sampled yet this minute. gold is the sum of reliable +
// unreliable gold (see FIELD_NOTES.md — current spendable gold isn't a
// single field). xp comes from the hero entity directly, not from either
// team-data entity (see FIELD_NOTES.md's XP section). totalEarnedGold is a
// separate all-time cumulative counter (m_iTotalEarnedGold) that never
// decreases on spend/death — OpenDota's real `total_gold` field is this
// cumulative figure, not current spendable gold (see FIELD_NOTES.md's gold
// section, which explicitly warns these are different fields).
func sampleMinute(p *PlayerParsed, minute int, gold, lastHits, denies, xp, totalEarnedGold int32, lastSampledMinute *int) {
	if *lastSampledMinute == minute {
		return
	}
	*lastSampledMinute = minute
	p.GoldT = append(p.GoldT, gold)
	p.LhT = append(p.LhT, lastHits)
	p.DnT = append(p.DnT, denies)
	p.XpT = append(p.XpT, xp)
	p.TotalGold = totalEarnedGold
}
