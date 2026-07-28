import type { ProDraftPairRow } from 'types'

// One pair as seen from a specific hero's point of view.
export type PairView = {
  partner: number
  winrate: number
  sample: number
}

export function partnerOf(row: ProDraftPairRow, heroId: number): number {
  return row.heroA === heroId ? row.heroB : row.heroA
}

// Synergy is symmetric, so this needs no perspective flip.
export function togetherWinrateFor(row: ProDraftPairRow): number | null {
  return row.together.sample === 0 ? null : row.together.wins / row.together.sample
}

// The API stores versus wins from heroA (the lower hero id) perspective, so
// asking about heroB means taking the complement.
export function versusWinrateFor(row: ProDraftPairRow, heroId: number): number | null {
  if (row.versus.sample === 0) return null
  const lowerWinrate = row.versus.wins / row.versus.sample
  return row.heroA === heroId ? lowerWinrate : 1 - lowerWinrate
}

function involves(row: ProDraftPairRow, heroId: number): boolean {
  return row.heroA === heroId || row.heroB === heroId
}

export function topPartners(
  rows: ProDraftPairRow[],
  heroId: number,
  minSample: number,
  limit: number,
): PairView[] {
  const views: PairView[] = []
  for (const row of rows) {
    if (!involves(row, heroId) || row.together.sample < minSample) continue
    const winrate = togetherWinrateFor(row)
    if (winrate === null) continue
    views.push({ partner: partnerOf(row, heroId), winrate, sample: row.together.sample })
  }
  return views.sort((a, b) => b.winrate - a.winrate).slice(0, limit)
}

export function worstMatchups(
  rows: ProDraftPairRow[],
  heroId: number,
  minSample: number,
  limit: number,
): PairView[] {
  const views: PairView[] = []
  for (const row of rows) {
    if (!involves(row, heroId) || row.versus.sample < minSample) continue
    const winrate = versusWinrateFor(row, heroId)
    if (winrate === null) continue
    views.push({ partner: partnerOf(row, heroId), winrate, sample: row.versus.sample })
  }
  return views.sort((a, b) => a.winrate - b.winrate).slice(0, limit)
}
