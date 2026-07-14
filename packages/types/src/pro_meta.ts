export type ProMetaPatch = {
  id: number
  name: string
  releasedAt: string
}

export type ProMetaWinrateCell = {
  winrate: number
  sample: number
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
