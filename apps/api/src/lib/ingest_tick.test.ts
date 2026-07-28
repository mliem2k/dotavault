import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '../db'
import { apiCache } from '../db/schema'
import { cacheGet, cacheSet } from './cache'
import { createTickRunner, type IngestState } from './ingest_tick'
import { emptyProMetaTally, type ProMetaTally } from './pro_meta'
import { runProMetaTick } from './pro_meta_tick'

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

// Lets a queued microtask (in particular createTickRunner's run().finally())
// actually settle before the next assertion.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  await db.delete(apiCache)
})

describe('runIngestTick, resumed-state normalization', () => {
  it(
    'folds against a pre-branch persisted tally missing newer fields without throwing, ' +
      'carries forward already-accumulated counters, and populates the new order buckets',
    async () => {
      // Shaped exactly like production's real pro-meta-ingest:{patchId} row
      // written by the pre-branch emptyProMetaTally(): heroPickOrder and
      // heroBanOrder are absent entirely, not present as empty objects.
      const preBranchTally = emptyProMetaTally() as Partial<ProMetaTally>
      preBranchTally.totalMatches = 5
      preBranchTally.heroPicks = { 1: 3 }
      delete preBranchTally.heroPickOrder
      delete preBranchTally.heroBanOrder

      const seededState: IngestState<ProMetaTally> = {
        highWaterMatchId: 100,
        remainingIds: [101],
        tally: preBranchTally as ProMetaTally,
        truncated: false,
      }
      await cacheSet('pro-meta-ingest:0', seededState, 60 * 60)

      const fetchFn = fakeFetch({
        '/matches/101': {
          patch: 0,
          game_mode: 2, // Captains Mode: required for order buckets to fold at all
          radiant_win: true,
          picks_bans: [
            { is_pick: true, hero_id: 1, team: 0, order: 0 },
            { is_pick: true, hero_id: 2, team: 1, order: 1 },
            { is_pick: false, hero_id: 3, team: 0, order: 2 },
          ],
          players: [],
        },
      })

      await expect(runProMetaTick(fetchFn)).resolves.toBeUndefined()

      const state = (await cacheGet('pro-meta-ingest:0')) as IngestState<ProMetaTally>
      // Seeded 5 plus the one match just folded, not reset to 1.
      expect(state.tally.totalMatches).toBe(6)
      // Seeded 3 plus this match's pick of hero 1, not reset to 1.
      expect(state.tally.heroPicks[1]).toBe(4)
      // The fields missing from the seeded blob populate correctly on this
      // very fold rather than staying absent or throwing.
      expect(state.tally.heroPickOrder).toEqual({ 1: { 0: 1 }, 2: { 1: 1 } })
      expect(state.tally.heroBanOrder).toEqual({ 3: { 2: 1 } })
    },
  )
})

describe('createTickRunner', () => {
  it('gives each call its own debounce state, so one runner cannot suppress another', async () => {
    let runsA = 0
    const runnerA = createTickRunner('a', async () => {
      runsA++
    })
    runnerA()
    await flush()
    expect(runsA).toBe(1)

    // Created well inside runner A's debounce window. If the two runners
    // shared lastAttemptMs/inProgress state instead of each closing over its
    // own, this call would be wrongly suppressed by A's recent attempt.
    let runsB = 0
    const runnerB = createTickRunner('b', async () => {
      runsB++
    })
    runnerB()
    await flush()
    expect(runsB).toBe(1)

    // Runner A, called again immediately, is still correctly debounced by
    // its own clock (unaffected by B's call in between).
    runnerA()
    await flush()
    expect(runsA).toBe(1)
  })
})
