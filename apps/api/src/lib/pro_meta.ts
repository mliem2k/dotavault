import type { Match, PickBan, ProMetaHeroRow, ProMetaResponse, ProMetaWinrateCell } from 'types'

// The team of the lowest-order pick entry. Unambiguous under Captains
// Mode's strictly sequential draft order. Returns null for non-CM matches
// (no picks_bans) or matches with bans but no picks recorded.
export function firstPickTeam(picksBans: PickBan[]): 0 | 1 | null {
  const picks = picksBans.filter((pb) => pb.is_pick)
  if (picks.length === 0) return null
  const first = picks.reduce((a, b) => (a.order < b.order ? a : b))
  return first.team === 0 ? 0 : 1
}

type HeroTally = { picks: number; wins: number }

function bumpTally(map: Map<number, HeroTally>, heroId: number, won: boolean): void {
  const cur = map.get(heroId) ?? { picks: 0, wins: 0 }
  cur.picks += 1
  if (won) cur.wins += 1
  map.set(heroId, cur)
}

function winrate(wins: number, total: number): number {
  return total > 0 ? wins / total : 0
}

function cell(wins: number, sample: number): ProMetaWinrateCell {
  return { winrate: winrate(wins, sample), sample }
}

export type ProMetaCore = Pick<ProMetaResponse, 'aggregate' | 'combination' | 'heroes'>

export function aggregateProMeta(matches: Match[]): ProMetaCore {
  let radiantWins = 0
  let direWins = 0
  let firstPickWins = 0
  let secondPickWins = 0
  let draftedMatches = 0

  const combo = {
    radiantFirst: { wins: 0, sample: 0 },
    radiantSecond: { wins: 0, sample: 0 },
    direFirst: { wins: 0, sample: 0 },
    direSecond: { wins: 0, sample: 0 },
  }

  const heroPicks = new Map<number, number>()
  const heroBans = new Map<number, number>()
  const heroWins = new Map<number, number>()
  const heroRadiant = new Map<number, HeroTally>()
  const heroDire = new Map<number, HeroTally>()
  const heroFirstPick = new Map<number, HeroTally>()
  const heroSecondPick = new Map<number, HeroTally>()

  for (const match of matches) {
    if (match.radiant_win) radiantWins += 1
    else direWins += 1

    const fp = match.picks_bans ? firstPickTeam(match.picks_bans) : null
    if (fp !== null) {
      draftedMatches += 1
      const firstPickWon = fp === 0 ? match.radiant_win : !match.radiant_win
      if (firstPickWon) firstPickWins += 1
      else secondPickWins += 1

      const radiantFirst = fp === 0
      const radiantCell = radiantFirst ? combo.radiantFirst : combo.radiantSecond
      const direCell = radiantFirst ? combo.direSecond : combo.direFirst
      radiantCell.sample += 1
      if (match.radiant_win) radiantCell.wins += 1
      direCell.sample += 1
      if (!match.radiant_win) direCell.wins += 1
    }

    for (const pb of match.picks_bans ?? []) {
      if (pb.hero_id <= 0) continue
      if (!pb.is_pick) {
        heroBans.set(pb.hero_id, (heroBans.get(pb.hero_id) ?? 0) + 1)
        continue
      }
      const heroWon = pb.team === 0 ? match.radiant_win : !match.radiant_win
      heroPicks.set(pb.hero_id, (heroPicks.get(pb.hero_id) ?? 0) + 1)
      if (heroWon) heroWins.set(pb.hero_id, (heroWins.get(pb.hero_id) ?? 0) + 1)
      bumpTally(pb.team === 0 ? heroRadiant : heroDire, pb.hero_id, heroWon)
      if (fp !== null)
        bumpTally(pb.team === fp ? heroFirstPick : heroSecondPick, pb.hero_id, heroWon)
    }
  }

  const totalMatches = matches.length
  const heroIds = new Set([...heroPicks.keys(), ...heroBans.keys()])
  const empty: HeroTally = { picks: 0, wins: 0 }
  const heroes: ProMetaHeroRow[] = [...heroIds].map((heroId) => {
    const picks = heroPicks.get(heroId) ?? 0
    const bans = heroBans.get(heroId) ?? 0
    const wins = heroWins.get(heroId) ?? 0
    const radiant = heroRadiant.get(heroId) ?? empty
    const dire = heroDire.get(heroId) ?? empty
    const first = heroFirstPick.get(heroId) ?? empty
    const second = heroSecondPick.get(heroId) ?? empty
    return {
      heroId,
      picks,
      bans,
      pickBanRate: totalMatches > 0 ? (picks + bans) / totalMatches : 0,
      winrate: winrate(wins, picks),
      radiant: cell(radiant.wins, radiant.picks),
      dire: cell(dire.wins, dire.picks),
      firstPick: cell(first.wins, first.picks),
      secondPick: cell(second.wins, second.picks),
    }
  })

  return {
    aggregate: {
      radiantWinrate: winrate(radiantWins, totalMatches),
      direWinrate: winrate(direWins, totalMatches),
      draftedMatches,
      firstPickWinrate: winrate(firstPickWins, draftedMatches),
      secondPickWinrate: winrate(secondPickWins, draftedMatches),
    },
    combination: {
      radiantFirst: cell(combo.radiantFirst.wins, combo.radiantFirst.sample),
      radiantSecond: cell(combo.radiantSecond.wins, combo.radiantSecond.sample),
      direFirst: cell(combo.direFirst.wins, combo.direFirst.sample),
      direSecond: cell(combo.direSecond.wins, combo.direSecond.sample),
    },
    heroes,
  }
}
