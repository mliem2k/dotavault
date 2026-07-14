import { beforeEach, describe, expect, it } from 'bun:test'
import type { Match, PickBan, ProMatch, ProMetaPatch, ProMetaResponse } from 'types'
import { db } from '../db'
import { apiCache } from '../db/schema'
import { cacheSet } from './cache'
import { aggregateProMeta, computeProMeta, firstPickTeam, getProMeta } from './pro_meta'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    match_id: 1,
    barracks_status_dire: 0,
    barracks_status_radiant: 0,
    cluster: 0,
    dire_score: 0,
    dire_team_id: null,
    duration: 1800,
    engine: 1,
    first_blood_time: 0,
    game_mode: 2,
    human_players: 10,
    leagueid: 0,
    lobby_type: 1,
    match_seq_num: 0,
    negative_votes: 0,
    objectives: null,
    picks_bans: null,
    positive_votes: 0,
    radiant_gold_adv: null,
    radiant_score: 0,
    radiant_team_id: null,
    radiant_win: true,
    radiant_xp_adv: null,
    skill: null,
    start_time: 0,
    teamfights: null,
    tower_status_dire: 0,
    tower_status_radiant: 0,
    version: null,
    patch: null,
    series_id: null,
    series_type: null,
    chat: null,
    players: [],
    ...overrides,
  }
}

function pb(overrides: Partial<PickBan>): PickBan {
  return { is_pick: true, hero_id: 1, team: 0, order: 0, ...overrides }
}

describe('firstPickTeam', () => {
  it('returns null for empty picks_bans', () => {
    expect(firstPickTeam([])).toBeNull()
  })

  it('returns null when there are only bans, no picks', () => {
    expect(firstPickTeam([pb({ is_pick: false, order: 0, team: 0 })])).toBeNull()
  })

  it('returns the team of the lowest-order pick, radiant', () => {
    const picksBans = [
      pb({ is_pick: false, order: 0, team: 1 }),
      pb({ is_pick: true, order: 1, team: 0, hero_id: 5 }),
      pb({ is_pick: true, order: 2, team: 1, hero_id: 6 }),
    ]
    expect(firstPickTeam(picksBans)).toBe(0)
  })

  it('returns the team of the lowest-order pick, dire', () => {
    const picksBans = [
      pb({ is_pick: true, order: 1, team: 1, hero_id: 5 }),
      pb({ is_pick: true, order: 2, team: 0, hero_id: 6 }),
    ]
    expect(firstPickTeam(picksBans)).toBe(1)
  })
})

describe('aggregateProMeta', () => {
  it('computes radiant/dire winrate over all matches, including undrafted ones', () => {
    const matches = [
      makeMatch({ match_id: 1, radiant_win: true, picks_bans: null }),
      makeMatch({ match_id: 2, radiant_win: false, picks_bans: null }),
    ]
    const { aggregate } = aggregateProMeta(matches)
    expect(aggregate.radiantWinrate).toBe(0.5)
    expect(aggregate.direWinrate).toBe(0.5)
    // no drafted matches -> 0, not NaN
    expect(aggregate.draftedMatches).toBe(0)
    expect(aggregate.firstPickWinrate).toBe(0)
    expect(aggregate.secondPickWinrate).toBe(0)
  })

  it('computes first/second pick winrate only over drafted matches', () => {
    const drafted = (radiantWin: boolean, radiantFirst: boolean) =>
      makeMatch({
        radiant_win: radiantWin,
        picks_bans: [
          pb({ is_pick: true, order: 0, team: radiantFirst ? 0 : 1, hero_id: 1 }),
          pb({ is_pick: true, order: 1, team: radiantFirst ? 1 : 0, hero_id: 2 }),
        ],
      })
    const matches = [
      drafted(true, true), // radiant first pick, radiant wins -> first pick won
      drafted(false, true), // radiant first pick, dire wins -> second pick won
      makeMatch({ radiant_win: true, picks_bans: null }), // excluded
    ]
    const { aggregate } = aggregateProMeta(matches)
    expect(aggregate.draftedMatches).toBe(2)
    expect(aggregate.firstPickWinrate).toBe(0.5)
    expect(aggregate.secondPickWinrate).toBe(0.5)
  })

  it('computes the radiant/dire x first/second-pick combination matrix', () => {
    const drafted = (radiantWin: boolean, radiantFirst: boolean) =>
      makeMatch({
        radiant_win: radiantWin,
        picks_bans: [
          pb({ is_pick: true, order: 0, team: radiantFirst ? 0 : 1, hero_id: 1 }),
          pb({ is_pick: true, order: 1, team: radiantFirst ? 1 : 0, hero_id: 2 }),
        ],
      })
    const matches = [drafted(true, true), drafted(false, false)]
    const { combination } = aggregateProMeta(matches)
    expect(combination.radiantFirst).toEqual({ winrate: 1, sample: 1 })
    expect(combination.direSecond).toEqual({ winrate: 0, sample: 1 })
    expect(combination.direFirst).toEqual({ winrate: 1, sample: 1 })
    expect(combination.radiantSecond).toEqual({ winrate: 0, sample: 1 })
  })

  it('tallies per-hero picks, bans, wins, and side/pick-order splits', () => {
    const matches = [
      makeMatch({
        radiant_win: true,
        picks_bans: [
          pb({ is_pick: false, order: 0, team: 1, hero_id: 9 }), // ban, not a pick
          pb({ is_pick: true, order: 1, team: 0, hero_id: 1 }), // radiant, first pick, wins
          pb({ is_pick: true, order: 2, team: 1, hero_id: 2 }), // dire, second pick, loses
        ],
      }),
    ]
    const { heroes } = aggregateProMeta(matches)
    const hero1 = heroes.find((h) => h.heroId === 1)
    const hero2 = heroes.find((h) => h.heroId === 2)
    const hero9 = heroes.find((h) => h.heroId === 9)

    expect(hero1).toMatchObject({
      picks: 1,
      bans: 0,
      winrate: 1,
      radiant: { winrate: 1, sample: 1 },
      dire: { winrate: 0, sample: 0 },
      firstPick: { winrate: 1, sample: 1 },
      secondPick: { winrate: 0, sample: 0 },
    })
    expect(hero2).toMatchObject({
      picks: 1,
      bans: 0,
      winrate: 0,
      dire: { winrate: 0, sample: 1 },
      secondPick: { winrate: 0, sample: 1 },
    })
    expect(hero9).toMatchObject({ picks: 0, bans: 1, winrate: 0 })
  })
})

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

const PATCH: ProMetaPatch = { id: 5, name: '7.40', releasedAt: '2026-01-01 00:00:00' }
const RELEASED_MS = new Date(PATCH.releasedAt).getTime()

function fakeFetch(pages: Record<string, unknown>) {
  return async (path: string) => {
    if (!(path in pages)) throw new Error(`unexpected fetch: ${path}`)
    return pages[path]
  }
}

describe('computeProMeta', () => {
  it('collects only matches at or after the patch release, tagged with the current patch id', async () => {
    const inPatch = proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000 })
    const beforePatch = proMatch({ match_id: 99, start_time: RELEASED_MS / 1000 - 1000 })
    const fetchFn = fakeFetch({
      '/proMatches': [inPatch, beforePatch],
      '/matches/100': makeMatch({ match_id: 100, patch: PATCH.id, picks_bans: null }),
    })
    const result = await computeProMeta(PATCH, fetchFn)
    expect(result.totalMatches).toBe(1)
    expect(result.truncated).toBe(false)
    expect(result.patch).toEqual(PATCH)
  })

  it('excludes a match whose own patch field does not match, even if start_time looked in range', async () => {
    const m = proMatch({ match_id: 100, start_time: RELEASED_MS / 1000 + 1000 })
    const fetchFn = fakeFetch({
      '/proMatches': [m],
      '/proMatches?less_than_match_id=100': [],
      '/matches/100': makeMatch({ match_id: 100, patch: PATCH.id - 1, picks_bans: null }),
    })
    const result = await computeProMeta(PATCH, fetchFn)
    expect(result.totalMatches).toBe(0)
  })

  it('paginates via less_than_match_id until it crosses the patch release cutoff', async () => {
    const page1 = [proMatch({ match_id: 200, start_time: RELEASED_MS / 1000 + 2000 })]
    const page2 = [proMatch({ match_id: 199, start_time: RELEASED_MS / 1000 - 1 })] // before cutoff
    const fetchFn = fakeFetch({
      '/proMatches': page1,
      '/proMatches?less_than_match_id=200': page2,
      '/matches/200': makeMatch({ match_id: 200, patch: PATCH.id, picks_bans: null }),
    })
    const result = await computeProMeta(PATCH, fetchFn)
    expect(result.totalMatches).toBe(1)
    expect(result.truncated).toBe(false)
  })

  it('retries a match detail fetch that fails transiently and still includes it in the result', async () => {
    let attempts = 0
    const fetchFn = async (path: string) => {
      if (path === '/proMatches') {
        return [proMatch({ match_id: 300, start_time: RELEASED_MS / 1000 + 1000 })]
      }
      if (path === '/proMatches?less_than_match_id=300') return []
      if (path === '/matches/300') {
        attempts += 1
        if (attempts < 3) throw new Error('429 rate limited')
        return makeMatch({ match_id: 300, patch: PATCH.id, picks_bans: null })
      }
      throw new Error(`unexpected fetch: ${path}`)
    }
    const result = await computeProMeta(PATCH, fetchFn, [0, 0, 0])
    expect(result.totalMatches).toBe(1)
    expect(attempts).toBe(3)
  })

  it('skips a match whose detail fetch keeps failing, without discarding other matches', async () => {
    const fetchFn = async (path: string) => {
      if (path === '/proMatches') {
        return [
          proMatch({ match_id: 301, start_time: RELEASED_MS / 1000 + 1000 }),
          proMatch({ match_id: 302, start_time: RELEASED_MS / 1000 + 1000 }),
        ]
      }
      if (path === '/proMatches?less_than_match_id=302') return []
      if (path === '/matches/301') throw new Error('429 rate limited')
      if (path === '/matches/302') {
        return makeMatch({ match_id: 302, patch: PATCH.id, picks_bans: null })
      }
      throw new Error(`unexpected fetch: ${path}`)
    }
    const result = await computeProMeta(PATCH, fetchFn, [0, 0])
    expect(result.totalMatches).toBe(1)
  })
})

describe('getProMeta', () => {
  beforeEach(async () => {
    await db.delete(apiCache)
  })

  it('returns the cached blob without recomputing when both patch and result are cached', async () => {
    // Fixed past dates so "current patch" resolution is deterministic
    // regardless of when this test runs.
    await cacheSet(
      'opendota:/constants/patch',
      [
        { name: '7.38', date: '2020-01-01 00:00:00' },
        { name: '7.39', date: '2021-01-01 00:00:00' },
      ],
      3600,
    )
    const blob: ProMetaResponse = {
      patch: { id: 1, name: '7.39', releasedAt: '2021-01-01 00:00:00' },
      totalMatches: 5,
      truncated: false,
      aggregate: {
        radiantWinrate: 0.5,
        direWinrate: 0.5,
        draftedMatches: 4,
        firstPickWinrate: 0.5,
        secondPickWinrate: 0.5,
      },
      combination: {
        radiantFirst: { winrate: 0.5, sample: 2 },
        radiantSecond: { winrate: 0.5, sample: 2 },
        direFirst: { winrate: 0.5, sample: 2 },
        direSecond: { winrate: 0.5, sample: 2 },
      },
      heroes: [],
    }
    await cacheSet('pro-meta:1', blob, 3600)

    expect(await getProMeta()).toEqual(blob)
  })

  it('falls back to a stale cached blob when computation fails', async () => {
    await cacheSet(
      'opendota:/constants/patch',
      [{ name: '7.39', date: '2020-01-01 00:00:00' }],
      3600,
    )
    const stale: ProMetaResponse = {
      patch: { id: 0, name: '7.39', releasedAt: '2020-01-01 00:00:00' },
      totalMatches: 3,
      truncated: false,
      aggregate: {
        radiantWinrate: 0.4,
        direWinrate: 0.6,
        draftedMatches: 2,
        firstPickWinrate: 0.4,
        secondPickWinrate: 0.6,
      },
      combination: {
        radiantFirst: { winrate: 0.4, sample: 1 },
        radiantSecond: { winrate: 0.4, sample: 1 },
        direFirst: { winrate: 0.6, sample: 1 },
        direSecond: { winrate: 0.6, sample: 1 },
      },
      heroes: [],
    }
    await cacheSet('pro-meta:0', stale, -1) // already expired -> only reachable via cacheGetStale
    const failingCompute = async (): Promise<ProMetaResponse> => {
      throw new Error('opendota unreachable')
    }
    expect(await getProMeta(failingCompute)).toEqual(stale)
  })

  it('returns null when computation fails and nothing is cached at all', async () => {
    await cacheSet(
      'opendota:/constants/patch',
      [{ name: '7.39', date: '2020-01-01 00:00:00' }],
      3600,
    )
    const failingCompute = async (): Promise<ProMetaResponse> => {
      throw new Error('opendota unreachable')
    }
    expect(await getProMeta(failingCompute)).toBeNull()
  })
})
