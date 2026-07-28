import type { ProMetaPatch } from './pro_meta'

export type ProDraftPairCell = {
  wins: number
  sample: number
}

// One unordered hero pair. heroA is always the lower hero id, so a pair is
// stored once rather than twice.
//
// `together` is symmetric: both heroes were on the same team, and wins
// counts that team's wins.
//
// `versus` is directional in principle, but storing it once from heroA's
// perspective halves the storage; a consumer looking at it from heroB's
// side flips the winrate (see pairWinrateFor in the web app).
export type ProDraftPairRow = {
  heroA: number
  heroB: number
  together: ProDraftPairCell
  versus: ProDraftPairCell
}

export type ProDraftPairsResponse = {
  patch: ProMetaPatch
  totalMatches: number
  truncated: boolean
  pairs: ProDraftPairRow[]
}
