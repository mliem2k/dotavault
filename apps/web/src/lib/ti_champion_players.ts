// Players on each year's actual grand-final winning roster. Unlike team_id
// (see ti_champions.ts), a roster's players can differ even in years where
// the same team_id won again — team_id 2163 won both TI2017 and TI2024 with
// completely different lineups, so team-level data alone can't answer "did
// this player win a TI."
//
// Verified individually against each year's real grand-final match data
// (OpenDota /leagues/:id/matches, sorted by start_time; the winning team_id
// on the most recent match cross-checked against the already-verified value
// in ti_champions.ts before trusting its player list). TI1 (2011) predates
// Dota 2's public league/match tracking entirely, so there's no match data
// to verify a roster against; omitted rather than guessed.
//
// personaname is whatever the account's Steam display name happened to be
// at data-collection time (2026), not their name during that tournament —
// display names are freely editable and many of these are a decade removed
// from the actual event, so don't read anything into a name looking
// unfamiliar for a given year.
export type TIChampionPlayer = { accountId: number; personaname: string }

const TI_CHAMPION_ROSTERS: Record<number, TIChampionPlayer[]> = {
  2012: [
    { accountId: 82327674, personaname: 'Koopa' },
    { accountId: 88585077, personaname: '没有人能在我的BGM里战胜我' },
    { accountId: 90137663, personaname: 'Zhou' },
    { accountId: 90045009, personaname: '运' },
    { accountId: 88553213, personaname: 'glhf' },
  ],
  2013: [
    { accountId: 41231571, personaname: 'Carl' },
    { accountId: 41288955, personaname: 'Akke' },
    { accountId: 101495620, personaname: 'Glorp' },
    { accountId: 3916428, personaname: 'pasta enjoyer' },
    { accountId: 76482434, personaname: 'AdmiralBulldog' },
  ],
  2014: [
    { accountId: 98887913, personaname: 'TIGER' },
    { accountId: 100883708, personaname: '凯瑞王' },
    { accountId: 88508515, personaname: 'Hao' },
    { accountId: 89217927, personaname: 'biubiubiu!' },
    { accountId: 89157606, personaname: '不出红到点丶' },
  ],
  2015: [
    { accountId: 86727555, personaname: 'ABOVE THE CLOUDS' },
    { accountId: 111620041, personaname: 'Miracle-' },
    { accountId: 87276347, personaname: 'z' },
    { accountId: 40547474, personaname: 'meowmeowcow' },
    { accountId: 87177591, personaname: 'F' },
  ],
  2016: [
    { accountId: 129585121, personaname: 'Shadow' },
    { accountId: 101586543, personaname: '跳刀跳刀丶' },
    { accountId: 118134220, personaname: 'Bach' },
    { accountId: 102644565, personaname: '李逍游' },
    { accountId: 111114687, personaname: '宇宙にきらめく エメラルド' },
  ],
  2017: [
    { accountId: 105248644, personaname: 'SawagedBlind' },
    { accountId: 34505203, personaname: 'MinD_ContRoL' },
    { accountId: 82262664, personaname: 'an najm' },
    { accountId: 101356886, personaname: 'gh' },
    { accountId: 72312627, personaname: 'kimchi' },
  ],
  2018: [
    { accountId: 19672354, personaname: 'OiOi.oldandrusty' },
    { accountId: 311360822, personaname: 'minioncheer' },
    { accountId: 26771994, personaname: 'JerAx' },
    { accountId: 88271237, personaname: 'BLAST^' },
    { accountId: 94054712, personaname: 'TOPSON' },
  ],
  2019: [
    { accountId: 19672354, personaname: 'OiOi.oldandrusty' },
    { accountId: 311360822, personaname: 'minioncheer' },
    { accountId: 26771994, personaname: 'JerAx' },
    { accountId: 88271237, personaname: 'BLAST^' },
    { accountId: 94054712, personaname: 'TOPSON' },
  ],
  2021: [
    { accountId: 113331514, personaname: 'Miposhka' },
    { accountId: 321580662, personaname: 'copia灬' },
    { accountId: 431770905, personaname: '∩ (◣_◢) ∩' },
    { accountId: 256156323, personaname: "tweekin'" },
    { accountId: 302214028, personaname: 'pos3jungler' },
  ],
  2022: [
    { accountId: 10366616, personaname: 'Sneyking' },
    { accountId: 100058342, personaname: 'I m Going To Be The Best Carry' },
    { accountId: 94786276, personaname: 'drown' },
    { accountId: 86698277, personaname: 'not human (животное)' },
    { accountId: 103735745, personaname: 'lostreak chicken' },
  ],
  2023: [
    { accountId: 321580662, personaname: 'copia灬' },
    { accountId: 113331514, personaname: 'Miposhka' },
    { accountId: 106305042, personaname: 'not_him' },
    { accountId: 256156323, personaname: "tweekin'" },
    { accountId: 302214028, personaname: 'pos3jungler' },
  ],
  2024: [
    { accountId: 54580962, personaname: 'Maelle' },
    { accountId: 86698277, personaname: 'not human (животное)' },
    { accountId: 201358612, personaname: 'мусор' },
    { accountId: 77490514, personaname: 'Boxi' },
    { accountId: 152962063, personaname: 'yondaime' },
  ],
  2025: [
    { accountId: 10366616, personaname: 'Sneyking' },
    { accountId: 100058342, personaname: 'I m Going To Be The Best Carry' },
    { accountId: 898455820, personaname: 'Буська' },
    { accountId: 183719386, personaname: 'Suma1L-' },
    { accountId: 25907144, personaname: 'my way' },
  ],
}

const byAccountId = new Map<number, number[]>()
for (const [year, roster] of Object.entries(TI_CHAMPION_ROSTERS)) {
  for (const p of roster) {
    byAccountId.set(p.accountId, [...(byAccountId.get(p.accountId) ?? []), Number(year)])
  }
}

export function tiChampionYears(accountId: number): number[] {
  return byAccountId.get(accountId) ?? []
}

export function isTIChampionPlayer(accountId: number): boolean {
  return byAccountId.has(accountId)
}
