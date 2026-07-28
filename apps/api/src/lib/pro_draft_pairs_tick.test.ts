import { beforeEach, describe, expect, it } from 'bun:test'
import type { ProDraftPairsResponse, ProMatch } from 'types'
import { db } from '../db'
import { apiCache } from '../db/schema'
import { cacheGet } from './cache'
import { runProDraftPairsTick } from './pro_draft_pairs_tick'

function proMatch(overrides: Partial<ProMatch>): ProMatch {
  return {
    match_id: 1,
    duration: 1800,
    start_time: 0,
    radiant_team_id: null,
    radiant_name: null,
    dire_team_id: null,
    dire_name: null,
    leagueid: 0,
    league_name: null,
    series_id: 0,
    series_type: 0,
    radiant_score: null,
    dire_score: null,
    radiant_win: true,
    ...overrides,
  }
}

const RELEASED_MS = new Date('2026-01-01 00:00:00').getTime()

const DEFAULT_PATCH_PAGES: Record<string, unknown> = {
  '/constants/patch': [{ name: '7.40', date: '2026-01-01 00:00:00' }],
}

function fakeFetch(pages: Record<string, unknown>) {
  const allPages = { ...DEFAULT_PATCH_PAGES, ...pages }
  return async (path: string) => {
    if (!(path in allPages)) throw new Error(`unexpected fetch: ${path}`)
    return allPages[path]
  }
}

const MULTI_TICK_TIMEOUT_MS = 20_000

function draft(radiantHeroes: number[], direHeroes: number[]) {
  return [
    ...radiantHeroes.map((hero_id, i) => ({ is_pick: true, hero_id, team: 0, order: i })),
    ...direHeroes.map((hero_id, i) => ({
      is_pick: true,
      hero_id,
      team: 1,
      order: radiantHeroes.length + i,
    })),
  ]
}

beforeEach(async () => {
  await db.delete(apiCache)
})

describe('runProDraftPairsTick', () => {
  it('builds the candidate list and folds one bounded batch into the result', async () => {
    const fetchFn = fakeFetch({
      '/proMatches': [proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000 })],
      '/proMatches?less_than_match_id=100': [],
      '/matches/100': {
        patch: 0,
        radiant_win: true,
        picks_bans: draft([1, 2], [8, 9]),
      },
    })

    await runProDraftPairsTick(fetchFn)

    const state = (await cacheGet('pro-draft-pairs-ingest:0')) as {
      remainingIds: number[]
      tally: { totalMatches: number }
    }
    expect(state.remainingIds).toEqual([])
    expect(state.tally.totalMatches).toBe(1)

    const result = (await cacheGet('pro-draft-pairs:0')) as ProDraftPairsResponse
    expect(result.totalMatches).toBe(1)
    // Radiant 1 and 2 played together and won.
    const pair = result.pairs.find((p) => p.heroA === 1 && p.heroB === 2)
    expect(pair?.together).toEqual({ wins: 1, sample: 1 })
  })

  it(
    'processes only TICK_BATCH_SIZE (20) matches per call, resuming the remaining one on the next call',
    async () => {
      // 21 candidates against a batch size of 20 forces a genuine split:
      // tick 1 must leave exactly one id unprocessed, and tick 2 must pick
      // it back up from persisted state rather than starting over. Built
      // programmatically so the split boundary (20 vs 21) is unambiguous.
      const matchIds = Array.from({ length: 21 }, (_, i) => 700 + i)
      const pages: Record<string, unknown> = {
        '/proMatches': matchIds.map((id) =>
          proMatch({ match_id: id, start_time: RELEASED_MS / 1000 + 1000 }),
        ),
        [`/proMatches?less_than_match_id=${matchIds[matchIds.length - 1]}`]: [],
      }
      for (const id of matchIds) {
        pages[`/matches/${id}`] = {
          patch: 0,
          radiant_win: true,
          picks_bans: draft([1, 2], [8, 9]),
        }
      }
      const fetchFn = fakeFetch(pages)

      await runProDraftPairsTick(fetchFn)
      let state = (await cacheGet('pro-draft-pairs-ingest:0')) as { remainingIds: number[] }
      expect(state.remainingIds).toEqual([matchIds[20]])

      let result = (await cacheGet('pro-draft-pairs:0')) as ProDraftPairsResponse
      expect(result.totalMatches).toBe(20)

      await runProDraftPairsTick(fetchFn)
      state = (await cacheGet('pro-draft-pairs-ingest:0')) as { remainingIds: number[] }
      expect(state.remainingIds).toEqual([])

      result = (await cacheGet('pro-draft-pairs:0')) as ProDraftPairsResponse
      expect(result.totalMatches).toBe(21)
    },
    MULTI_TICK_TIMEOUT_MS,
  )

  it(
    'once fully caught up, a second tick that finds no newer matches leaves the tally unchanged',
    async () => {
      const detail = (radiantWin: boolean) => ({
        patch: 0,
        radiant_win: radiantWin,
        picks_bans: draft([1, 2], [8, 9]),
      })
      const fetchFn = fakeFetch({
        '/proMatches': [
          proMatch({ match_id: 101, start_time: RELEASED_MS / 1000 + 2000 }),
          proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000 }),
        ],
        '/proMatches?less_than_match_id=100': [],
        '/matches/101': detail(true),
        '/matches/100': detail(false),
      })

      // Both candidates fit in a single 20-sized batch, so this tick
      // finishes them in one call and the second call exercises the
      // "fully caught up, check for newer matches" branch instead: it
      // finds nothing past the high-water mark and leaves the tally as is.
      await runProDraftPairsTick(fetchFn)
      await runProDraftPairsTick(fetchFn)

      const result = (await cacheGet('pro-draft-pairs:0')) as ProDraftPairsResponse
      expect(result.totalMatches).toBe(2)
      // Radiant pair 1 and 2 won exactly one of the two matches.
      const pair = result.pairs.find((p) => p.heroA === 1 && p.heroB === 2)
      expect(pair?.together).toEqual({ wins: 1, sample: 2 })
    },
    MULTI_TICK_TIMEOUT_MS,
  )

  it('skips matches belonging to a different patch', async () => {
    const fetchFn = fakeFetch({
      '/proMatches': [proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000 })],
      '/proMatches?less_than_match_id=100': [],
      '/matches/100': { patch: 99, radiant_win: true, picks_bans: draft([1, 2], [8, 9]) },
    })

    await runProDraftPairsTick(fetchFn)

    const result = (await cacheGet('pro-draft-pairs:0')) as ProDraftPairsResponse
    expect(result.totalMatches).toBe(0)
    expect(result.pairs).toEqual([])
  })
})
