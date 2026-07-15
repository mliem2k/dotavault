import type { PickBan, ProMetaResponse } from 'types'
import { cacheGet, cacheSet } from './cache'
import { fetchCached } from './opendota'
import { resolveCurrentPatch } from './patch'
import {
  collectCandidateMatchIds,
  emptyProMetaTally,
  finalizeProMetaTally,
  foldMatchIntoTally,
  type MatchPlayerForLane,
  type ProMetaTally,
  proMetaResultKey,
} from './pro_meta'

// Minimal per-match fields foldMatchIntoTally actually needs. Fetched
// per-match, folded into the running tally, then discarded - never
// persisted raw (see ProMetaTally's doc comment for why: a prior version
// kept every match's raw data around and grew to 40+MB, OOM-killing the
// API).
type CollectedMatch = {
  radiant_win: boolean
  picks_bans: PickBan[] | null
  players: MatchPlayerForLane[]
}

type IngestState = {
  highWaterMatchId: number | null
  remainingIds: number[]
  tally: ProMetaTally
  truncated: boolean
}

const STATE_TTL_SECONDS = 60 * 60 * 24 * 14 // 2 weeks - a patch rarely lives longer
const RESULT_TTL_SECONDS = 60 * 60 * 24 * 14
const TICK_BATCH_SIZE = 5
const RETRY_DELAYS_MS = [1000, 3000, 8000]

type FetchFn = (path: string, ttlSeconds: number) => Promise<unknown>

function stateKey(patchId: number): string {
  return `pro-meta-ingest:${patchId}`
}

async function fetchMatchDetailForIngest(
  id: number,
  patchId: number,
  fetchFn: FetchFn,
  retryDelaysMs: number[],
): Promise<CollectedMatch | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const detail = (await fetchFn(`/matches/${id}`, 60 * 60 * 24 * 7)) as {
        patch: number | null
        radiant_win: boolean
        picks_bans: PickBan[] | null
        players: MatchPlayerForLane[]
      }
      if (detail.patch !== patchId) return null
      return {
        radiant_win: detail.radiant_win,
        picks_bans: detail.picks_bans,
        players: detail.players,
      }
    } catch (err) {
      if (attempt >= retryDelaysMs.length) {
        console.error(`pro meta tick: giving up on match ${id} after ${attempt + 1} attempts`, err)
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
  }
}

// Advances pro-meta ingestion for the current patch by one small, bounded
// slice of work: a handful of match-detail fetches, or (once fully caught
// up) one cheap check for newer matches. Resumable across restarts via
// state persisted in apiCache, and safe to call repeatedly - each call
// picks up exactly where the last one left off. This replaces trying to
// fetch hundreds of match details synchronously within a single HTTP
// request, which routinely exceeded both OpenDota's rate limit and Fly's
// gateway timeout in production.
export async function runProMetaTick(fetchFn: FetchFn = fetchCached): Promise<void> {
  const patch = await resolveCurrentPatch()
  const sKey = stateKey(patch.id)
  const releasedAtMs = new Date(patch.releasedAt).getTime()

  let state = (await cacheGet(sKey)) as IngestState | null
  if (!state) {
    const { ids, truncated } = await collectCandidateMatchIds(releasedAtMs, fetchFn)
    state = {
      highWaterMatchId: ids[0] ?? null,
      remainingIds: ids,
      tally: emptyProMetaTally(),
      truncated,
    }
    await cacheSet(sKey, state, STATE_TTL_SECONDS)
  }

  if (state.remainingIds.length === 0) {
    // Fully caught up as of the last pass. Cheaply check for newer matches
    // (stopping as soon as we hit our high-water mark) so the dataset keeps
    // growing as new pro matches get played, rather than freezing at
    // whatever existed when the backfill finished.
    const { ids: newIds, truncated } = await collectCandidateMatchIds(
      releasedAtMs,
      fetchFn,
      state.highWaterMatchId,
    )
    if (newIds.length === 0) return
    state = {
      highWaterMatchId: newIds[0],
      remainingIds: newIds,
      tally: state.tally,
      truncated: state.truncated || truncated,
    }
    await cacheSet(sKey, state, STATE_TTL_SECONDS)
  }

  const batchIds = state.remainingIds.slice(0, TICK_BATCH_SIZE)
  const rest = state.remainingIds.slice(TICK_BATCH_SIZE)

  for (const id of batchIds) {
    const detail = await fetchMatchDetailForIngest(id, patch.id, fetchFn, RETRY_DELAYS_MS)
    if (detail) foldMatchIntoTally(state.tally, detail)
  }

  state = { ...state, remainingIds: rest }
  await cacheSet(sKey, state, STATE_TTL_SECONDS)

  const core = finalizeProMetaTally(state.tally)
  const response: ProMetaResponse = {
    patch,
    totalMatches: state.tally.totalMatches,
    truncated: state.truncated,
    ...core,
  }
  await cacheSet(proMetaResultKey(patch.id), response, RESULT_TTL_SECONDS)
}

const TICK_DEBOUNCE_MS = 15_000
let lastTickAttemptMs = 0
let tickInProgress = false

// Fire-and-forget: kicks off (at most one at a time, at most once per
// TICK_DEBOUNCE_MS) a tick without awaiting it in the request path. Meant
// to be called from an onRequest hook on real API traffic.
export function maybeRunProMetaTick(): void {
  const now = Date.now()
  if (tickInProgress || now - lastTickAttemptMs < TICK_DEBOUNCE_MS) return
  lastTickAttemptMs = now
  tickInProgress = true
  runProMetaTick()
    .catch((err) => console.error('pro meta tick failed', err))
    .finally(() => {
      tickInProgress = false
    })
}
