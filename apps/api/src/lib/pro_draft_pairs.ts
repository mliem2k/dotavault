import type { Match, ProDraftPairRow, ProDraftPairsResponse } from 'types'
import { cacheGetStale } from './cache'
import { fetchCached } from './opendota'
import { resolveCurrentPatch } from './patch'

/* Hero pair synergy and counters for current-patch pro matches.
   Deliberately a separate pipeline from pro_meta.ts rather than more
   fields on ProMetaTally: with ~130 heroes there are C(130,2) = 8385
   pairs, roughly 65x the hero tally, and pro-meta's blob is read on every
   Pro Meta page load. Inflating that payload to serve a feature read far
   less often is the wrong trade, so pairs get their own cache key. */

type PairCell = { wins: number; sample: number }

// Bounded by a fixed domain (hero pairs), never keyed by match id. Same
// constraint pro_meta.ts's tally follows, for the same reason: an earlier
// version there kept raw per-match records, grew past 40MB, and OOM-killed
// the API.
export type ProDraftPairTally = {
  totalMatches: number
  // pairKey(a, b) -> cells. versus.wins counts wins for the LOWER hero id.
  pairs: Record<string, { together: PairCell; versus: PairCell }>
}

export function emptyPairTally(): ProDraftPairTally {
  return { totalMatches: 0, pairs: {} }
}

export function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function cellsFor(tally: ProDraftPairTally, a: number, b: number) {
  const key = pairKey(a, b)
  const existing = tally.pairs[key]
  if (existing) return existing
  const created = { together: { wins: 0, sample: 0 }, versus: { wins: 0, sample: 0 } }
  tally.pairs[key] = created
  return created
}

// Mutates tally in place with one match's contribution. Unlike pro_meta's
// order buckets, this does not filter on game mode: "these two heroes were
// on the same team and won" is meaningful however they got drafted.
export function foldMatchIntoPairTally(
  tally: ProDraftPairTally,
  match: Pick<Match, 'radiant_win' | 'picks_bans'>,
): void {
  tally.totalMatches += 1

  const radiant: number[] = []
  const dire: number[] = []
  for (const pb of match.picks_bans ?? []) {
    // Bans have no teammates or opponents, so they contribute nothing here.
    if (!pb.is_pick || pb.hero_id <= 0) continue
    if (pb.team === 0) radiant.push(pb.hero_id)
    else dire.push(pb.hero_id)
  }

  const sameTeam = (heroes: number[], won: boolean) => {
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        if (heroes[i] === heroes[j]) continue
        const cells = cellsFor(tally, heroes[i], heroes[j])
        cells.together.sample += 1
        if (won) cells.together.wins += 1
      }
    }
  }
  sameTeam(radiant, match.radiant_win)
  sameTeam(dire, !match.radiant_win)

  for (const r of radiant) {
    for (const d of dire) {
      // A hero cannot legally be on both sides, but a malformed picks_bans
      // would otherwise create a nonsense self-pair like "5-5".
      if (r === d) continue
      const cells = cellsFor(tally, r, d)
      cells.versus.sample += 1
      // versus.wins is always from the lower hero id's perspective.
      const lowerIsRadiant = r < d
      const lowerWon = lowerIsRadiant ? match.radiant_win : !match.radiant_win
      if (lowerWon) cells.versus.wins += 1
    }
  }
}

export function finalizePairTally(tally: ProDraftPairTally): ProDraftPairRow[] {
  return Object.entries(tally.pairs)
    .map(([key, cells]) => {
      const [a, b] = key.split('-').map(Number)
      return { heroA: a, heroB: b, together: cells.together, versus: cells.versus }
    })
    .sort((x, y) => x.heroA - y.heroA || x.heroB - y.heroB)
}

export function proDraftPairsResultKey(patchId: number): string {
  return `pro-draft-pairs:${patchId}`
}

type FetchFn = (path: string, ttlSeconds: number) => Promise<unknown>

// A pure cache read, same contract as pro_meta.ts's getProMeta: computation
// happens only in the background tick, never on the request path.
// cacheGetStale so a past-TTL blob is still served rather than discarded.
export async function getProDraftPairs(
  fetchFn: FetchFn = fetchCached,
): Promise<ProDraftPairsResponse | null> {
  try {
    const patch = await resolveCurrentPatch(fetchFn)
    const cached = await cacheGetStale(proDraftPairsResultKey(patch.id))
    return cached ? (cached.data as ProDraftPairsResponse) : null
  } catch (err) {
    console.error('pro draft pairs patch resolution failed', err)
    return null
  }
}
