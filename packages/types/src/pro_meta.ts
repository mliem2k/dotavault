export type ProMetaPatch = {
  id: number
  name: string
  releasedAt: string
}

export type ProMetaWinrateCell = {
  winrate: number
  sample: number
}

// OpenDota's lane_role on a match player: 1 safe, 2 mid, 3 off, 4 jungle.
// picks/wins here are this hero's real pick count and win count when
// played in that lane, across the sampled pro matches - not a heuristic.
export type ProMetaLaneRole = {
  laneRole: number
  picks: number
  wins: number
}

export type ProMetaHeroRow = {
  heroId: number
  picks: number
  bans: number
  pickBanRate: number
  winrate: number
  radiant: ProMetaWinrateCell
  dire: ProMetaWinrateCell
  firstPick: ProMetaWinrateCell
  secondPick: ProMetaWinrateCell
  laneRoles: ProMetaLaneRole[]
}

export type ProMetaResponse = {
  patch: ProMetaPatch
  totalMatches: number
  truncated: boolean
  aggregate: {
    radiantWinrate: number
    direWinrate: number
    // Sample size for radiant/direWinrate is totalMatches. firstPick/
    // secondPickWinrate are computed only over matches with picks_bans,
    // a subset of totalMatches — draftedMatches is their real sample size.
    draftedMatches: number
    firstPickWinrate: number
    secondPickWinrate: number
  }
  combination: {
    radiantFirst: ProMetaWinrateCell
    radiantSecond: ProMetaWinrateCell
    direFirst: ProMetaWinrateCell
    direSecond: ProMetaWinrateCell
  }
  heroes: ProMetaHeroRow[]
}
