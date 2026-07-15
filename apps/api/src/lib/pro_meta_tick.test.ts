import { beforeEach, describe, expect, it } from 'bun:test'
import type { ProMatch, ProMetaResponse } from 'types'
import { db } from '../db'
import { apiCache } from '../db/schema'
import { cacheGet, cacheSet } from './cache'
import { runProMetaTick } from './pro_meta_tick'

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

function fakeFetch(pages: Record<string, unknown>) {
  return async (path: string) => {
    if (!(path in pages)) throw new Error(`unexpected fetch: ${path}`)
    return pages[path]
  }
}

// Each runProMetaTick call is several sequential DB round-trips. On a
// remote CI Neon branch (higher latency than a local connection) a test
// that calls it twice can exceed bun:test's 5000ms default, so those tests
// get an explicit, more generous timeout.
const MULTI_TICK_TIMEOUT_MS = 20_000

beforeEach(async () => {
  await db.delete(apiCache)
  await cacheSet('opendota:/constants/patch', [{ name: '7.40', date: '2026-01-01 00:00:00' }], 3600)
})

describe('runProMetaTick', () => {
  it('on the first call, builds the candidate list and processes one bounded batch', async () => {
    const fetchFn = fakeFetch({
      '/proMatches': [
        proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000, radiant_win: true }),
      ],
      '/proMatches?less_than_match_id=100': [],
      '/matches/100': { patch: 0, radiant_win: true, picks_bans: null, players: [] },
    })

    await runProMetaTick(fetchFn)

    const state = (await cacheGet('pro-meta-ingest:0')) as {
      remainingIds: number[]
      collected: unknown[]
    }
    expect(state.remainingIds).toEqual([])
    expect(state.collected.length).toBe(1)

    const result = (await cacheGet('pro-meta:0')) as ProMetaResponse
    expect(result.totalMatches).toBe(1)
    expect(result.aggregate.radiantWinrate).toBe(1)
  })

  it(
    'processes only TICK_BATCH_SIZE (5) matches per call, resuming from persisted state on the next call',
    async () => {
      const matchIds = [201, 202, 203, 204, 205, 206]
      const pages: Record<string, unknown> = {
        '/proMatches': matchIds.map((id) =>
          proMatch({ match_id: id, start_time: RELEASED_MS / 1000 + 1000 }),
        ),
        '/proMatches?less_than_match_id=206': [],
      }
      for (const id of matchIds) {
        pages[`/matches/${id}`] = { patch: 0, radiant_win: true, picks_bans: null, players: [] }
      }
      const fetchFn = fakeFetch(pages)

      await runProMetaTick(fetchFn)
      let state = (await cacheGet('pro-meta-ingest:0')) as { remainingIds: number[] }
      expect(state.remainingIds).toEqual([206]) // 6 candidates, 5 processed this tick

      let result = (await cacheGet('pro-meta:0')) as ProMetaResponse
      expect(result.totalMatches).toBe(5)

      await runProMetaTick(fetchFn)
      state = (await cacheGet('pro-meta-ingest:0')) as { remainingIds: number[] }
      expect(state.remainingIds).toEqual([])

      result = (await cacheGet('pro-meta:0')) as ProMetaResponse
      expect(result.totalMatches).toBe(6)
    },
    MULTI_TICK_TIMEOUT_MS,
  )

  it('excludes a match whose own patch field does not match', async () => {
    const fetchFn = fakeFetch({
      '/proMatches': [proMatch({ match_id: 300, start_time: RELEASED_MS / 1000 + 1000 })],
      '/proMatches?less_than_match_id=300': [],
      '/matches/300': { patch: 99, radiant_win: true, picks_bans: null, players: [] },
    })

    await runProMetaTick(fetchFn)

    const result = (await cacheGet('pro-meta:0')) as ProMetaResponse
    expect(result.totalMatches).toBe(0)
  })

  it(
    'once fully caught up, a later tick checks for and ingests newer matches',
    async () => {
      const firstPassFetch = fakeFetch({
        '/proMatches': [proMatch({ match_id: 400, start_time: RELEASED_MS / 1000 + 1000 })],
        '/proMatches?less_than_match_id=400': [],
        '/matches/400': { patch: 0, radiant_win: true, picks_bans: null, players: [] },
      })
      await runProMetaTick(firstPassFetch)
      let result = (await cacheGet('pro-meta:0')) as ProMetaResponse
      expect(result.totalMatches).toBe(1)

      // A newer match (401) has since appeared; the refresh check should stop
      // at the high-water mark (400) rather than re-walking the whole patch.
      const refreshFetch = fakeFetch({
        '/proMatches': [
          proMatch({ match_id: 401, start_time: RELEASED_MS / 1000 + 2000 }),
          proMatch({ match_id: 400, start_time: RELEASED_MS / 1000 + 1000 }),
        ],
        '/matches/401': { patch: 0, radiant_win: false, picks_bans: null, players: [] },
      })
      await runProMetaTick(refreshFetch)

      result = (await cacheGet('pro-meta:0')) as ProMetaResponse
      expect(result.totalMatches).toBe(2)
    },
    MULTI_TICK_TIMEOUT_MS,
  )

  it(
    'a no-op refresh tick (no new matches) leaves the cached result untouched',
    async () => {
      const firstPassFetch = fakeFetch({
        '/proMatches': [proMatch({ match_id: 500, start_time: RELEASED_MS / 1000 + 1000 })],
        '/proMatches?less_than_match_id=500': [],
        '/matches/500': { patch: 0, radiant_win: true, picks_bans: null, players: [] },
      })
      await runProMetaTick(firstPassFetch)

      const noNewMatchesFetch = fakeFetch({
        '/proMatches': [proMatch({ match_id: 500, start_time: RELEASED_MS / 1000 + 1000 })],
      })
      await runProMetaTick(noNewMatchesFetch)

      const result = (await cacheGet('pro-meta:0')) as ProMetaResponse
      expect(result.totalMatches).toBe(1)
    },
    MULTI_TICK_TIMEOUT_MS,
  )
})
