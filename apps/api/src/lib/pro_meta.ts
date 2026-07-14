import type {
  Match,
  PickBan,
  ProMatch,
  ProMetaHeroRow,
  ProMetaPatch,
  ProMetaResponse,
  ProMetaWinrateCell,
} from 'types'
import { cacheGetStale, cacheSet } from './cache'
import { fetchCached } from './opendota'
import { resolveCurrentPatch } from './patch'

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

const MAX_PAGES = 20

// OpenDota's free tier caps at ~60 requests/min. Fetching match details one
// at a time with no backoff meant a single 429 partway through aborted the
// entire computation (nothing cached yet -> hard 503), observed in
// production on the very first cold computation for a patch. Bounded
// concurrency plus per-match retry-then-skip keeps one flaky/rate-limited
// match from taking down the whole batch, and finishes faster than a fully
// sequential loop.
const MATCH_DETAIL_CONCURRENCY = 5
const MATCH_DETAIL_RETRY_DELAYS_MS = [1000, 3000, 8000]

type FetchFn = (path: string, ttlSeconds: number) => Promise<unknown>

async function fetchMatchDetail(
  id: number,
  fetchFn: FetchFn,
  retryDelaysMs: number[],
): Promise<Match | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await fetchFn(`/matches/${id}`, 60 * 60 * 24 * 7)) as Match
    } catch (err) {
      if (attempt >= retryDelaysMs.length) {
        console.error(`pro meta: giving up on match ${id} after ${attempt + 1} attempts`, err)
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
  }
}

export async function computeProMeta(
  patch: ProMetaPatch,
  fetchFn: FetchFn = fetchCached,
  retryDelaysMs: number[] = MATCH_DETAIL_RETRY_DELAYS_MS,
): Promise<ProMetaResponse> {
  const releasedAtMs = new Date(patch.releasedAt).getTime()

  const candidateIds: number[] = []
  let cursor: number | undefined
  let truncated = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const path = cursor ? `/proMatches?less_than_match_id=${cursor}` : '/proMatches'
    const batch = (await fetchFn(path, 60 * 30)) as ProMatch[]
    if (batch.length === 0) break

    let hitCutoff = false
    for (const m of batch) {
      if (m.start_time * 1000 < releasedAtMs) {
        hitCutoff = true
        break
      }
      candidateIds.push(m.match_id)
    }
    if (hitCutoff) break

    cursor = batch[batch.length - 1].match_id
    if (page === MAX_PAGES - 1) truncated = true
  }

  const matches: Match[] = []
  for (let i = 0; i < candidateIds.length; i += MATCH_DETAIL_CONCURRENCY) {
    const batchIds = candidateIds.slice(i, i + MATCH_DETAIL_CONCURRENCY)
    const details = await Promise.all(
      batchIds.map((id) => fetchMatchDetail(id, fetchFn, retryDelaysMs)),
    )
    for (const detail of details) {
      if (detail && detail.patch === patch.id) matches.push(detail)
    }
  }

  const core = aggregateProMeta(matches)
  return { patch, totalMatches: matches.length, truncated, ...core }
}

// compute is injectable so tests can force the failure branch deterministically,
// without depending on network access — mirrors computeProMeta's fetchFn param.
//
// Uses cacheGetStale (not cacheGet) for the initial read too: cacheGet
// deletes an expired row as a side effect of reading it, which would erase
// the fallback data before the catch block below ever got a chance to use
// it. cacheGetStale never deletes, so this one read covers both the
// freshness check and the failure-path fallback.
export async function getProMeta(
  compute: (patch: ProMetaPatch) => Promise<ProMetaResponse> = computeProMeta,
): Promise<ProMetaResponse | null> {
  // resolveCurrentPatch is inside the try too: if it throws (e.g. OpenDota
  // fully unreachable and /constants/patch isn't cached), there's no patch
  // id to build a cache key from anyway, so there's no stale blob to fall
  // back to. The route should still see this as "not available" (503), not
  // an unhandled rejection turning into a 500.
  try {
    const patch = await resolveCurrentPatch()
    const key = `pro-meta:${patch.id}`

    const cached = await cacheGetStale(key)
    if (cached && !cached.stale) return cached.data as ProMetaResponse

    try {
      const result = await compute(patch)
      await cacheSet(key, result, 60 * 60 * 4)
      return result
    } catch (err) {
      console.error('pro meta computation failed', err)
      return cached ? (cached.data as ProMetaResponse) : null
    }
  } catch (err) {
    console.error('pro meta patch resolution failed', err)
    return null
  }
}
