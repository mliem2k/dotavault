// The International champions, by OpenDota team_id. Team orgs sometimes
// rebrand the same team_id years later (Evil Geniuses' NA slot is now
// "Shopify Rebellion" in OpenDota, for example), so `wonAs` records the
// name they actually lifted the Aegis under when it differs from whatever
// OpenDota calls that team_id today.
//
// Verified individually against each year's real grand-final match data
// (OpenDota /leagues/:id/matches, winning team_id cross-checked against
// /teams/:id) rather than assumed from name alone, except TI1 (2011),
// which predates Dota 2's public league tracking and has no match data to
// verify against; that entry rests on well-established public record.
export type TIChampionship = { year: number; teamId: number; wonAs?: string }

export const TI_CHAMPIONSHIPS: TIChampionship[] = [
  { year: 2011, teamId: 36, wonAs: 'Natus Vincere' },
  { year: 2012, teamId: 5 },
  { year: 2013, teamId: 111474 },
  { year: 2014, teamId: 1375614 },
  { year: 2015, teamId: 39, wonAs: 'Evil Geniuses' },
  { year: 2016, teamId: 1836806 },
  { year: 2017, teamId: 2163 },
  { year: 2018, teamId: 2586976 },
  { year: 2019, teamId: 2586976 },
  { year: 2021, teamId: 7119388 }, // TI10, delayed a year by COVID
  { year: 2022, teamId: 8291895 },
  { year: 2023, teamId: 7119388 },
  { year: 2024, teamId: 2163 },
  { year: 2025, teamId: 9247354 },
]

const byTeam = new Map<number, TIChampionship[]>()
for (const c of TI_CHAMPIONSHIPS) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), c])

export function tiChampionships(teamId: number): TIChampionship[] {
  return byTeam.get(teamId) ?? []
}

export function isTIChampion(teamId: number): boolean {
  return byTeam.has(teamId)
}
