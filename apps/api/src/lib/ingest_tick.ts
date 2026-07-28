import type { ProMetaPatch } from 'types'
import { cacheGet, cacheSet } from './cache'
import { fetchCached } from './opendota'
import { resolveCurrentPatch } from './patch'
import { collectCandidateMatchIds } from './pro_meta'

/* Generic resumable ingest tick, shared by every pro-match aggregation
   pipeline. Each pipeline supplies a config: where to cache, how big a
   batch to take, how to build an empty tally, how to pull the per-match
   fields it folds, and how to shape its response. Everything else (ingest
   state, batching, the high-water check for newer matches, persistence) is
   identical across pipelines and lives here once.

   The design constraints this preserves, both learned the hard way in
   production: the tally is bounded by a fixed domain and never keyed by
   match id (an earlier version kept raw per-match records, grew past 40MB
   and OOM-killed the API), and computation never happens on the request
   path (doing it synchronously blew through both OpenDota's rate limit and
   Fly's gateway timeout). */

export type FetchFn = (path: string, ttlSeconds: number) => Promise<unknown>

const STATE_TTL_SECONDS = 60 * 60 * 24 * 14 // 2 weeks, a patch rarely lives longer
const RESULT_TTL_SECONDS = 60 * 60 * 24 * 14
const DEFAULT_RETRY_DELAYS_MS = [1000, 3000, 8000]

export type IngestState<TTally> = {
  highWaterMatchId: number | null
  remainingIds: number[]
  tally: TTally
  truncated: boolean
}

// Fetches one match detail, retrying transient failures before giving up and
// skipping that match, so one flaky or rate-limited match never aborts the
// batch. Matches belonging to a different patch are dropped. select() pulls
// only the fields the calling pipeline folds, so nothing carries fields it
// does not use.
export async function fetchMatchDetailWithRetry<TDetail>(
  id: number,
  patchId: number,
  fetchFn: FetchFn,
  label: string,
  select: (raw: Record<string, unknown>) => TDetail,
  retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<TDetail | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = (await fetchFn(`/matches/${id}`, 60 * 60 * 24 * 7)) as Record<string, unknown>
      if (raw.patch !== patchId) return null
      return select(raw)
    } catch (err) {
      if (attempt >= retryDelaysMs.length) {
        console.error(`${label}: giving up on match ${id} after ${attempt + 1} attempts`, err)
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
  }
}

export type IngestTickConfig<TTally, TDetail, TResponse> = {
  // Used in error logs, e.g. "pro meta tick".
  label: string
  stateKey: (patchId: number) => string
  resultKey: (patchId: number) => string
  batchSize: number
  emptyTally: () => TTally
  fetchDetail: (id: number, patchId: number, fetchFn: FetchFn) => Promise<TDetail | null>
  fold: (tally: TTally, detail: TDetail) => void
  buildResponse: (input: { patch: ProMetaPatch; tally: TTally; truncated: boolean }) => TResponse
}

// Advances one pipeline's ingestion by a single bounded slice of work.
// Resumable across restarts via state in apiCache, and safe to call
// repeatedly: each call picks up exactly where the last one stopped.
export async function runIngestTick<TTally, TDetail, TResponse>(
  config: IngestTickConfig<TTally, TDetail, TResponse>,
  fetchFn: FetchFn = fetchCached,
): Promise<void> {
  const patch = await resolveCurrentPatch(fetchFn)
  const sKey = config.stateKey(patch.id)
  const releasedAtMs = new Date(patch.releasedAt).getTime()

  let state = (await cacheGet(sKey)) as IngestState<TTally> | null
  if (!state) {
    const { ids, truncated } = await collectCandidateMatchIds(releasedAtMs, fetchFn)
    state = {
      highWaterMatchId: ids[0] ?? null,
      remainingIds: ids,
      tally: config.emptyTally(),
      truncated,
    }
    await cacheSet(sKey, state, STATE_TTL_SECONDS)
  }

  if (state.remainingIds.length === 0) {
    // Fully caught up as of the last pass. Cheaply check for newer matches
    // (stopping at our high-water mark) so the dataset keeps growing rather
    // than freezing at whatever existed when the backfill finished.
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

  const batchIds = state.remainingIds.slice(0, config.batchSize)
  const rest = state.remainingIds.slice(config.batchSize)

  for (const id of batchIds) {
    const detail = await config.fetchDetail(id, patch.id, fetchFn)
    if (detail) config.fold(state.tally, detail)
  }

  state = { ...state, remainingIds: rest }
  await cacheSet(sKey, state, STATE_TTL_SECONDS)

  await cacheSet(
    config.resultKey(patch.id),
    config.buildResponse({ patch, tally: state.tally, truncated: state.truncated }),
    RESULT_TTL_SECONDS,
  )
}

// Wraps a tick in a fire-and-forget guard: at most one run at a time, and at
// most one attempt per debounce window. Meant to be called from an onRequest
// hook, so real traffic drives ingestion without needing a cron.
export function createTickRunner(
  label: string,
  run: () => Promise<void>,
  debounceMs = 15_000,
): () => void {
  let lastAttemptMs = 0
  let inProgress = false
  return () => {
    const now = Date.now()
    if (inProgress || now - lastAttemptMs < debounceMs) return
    lastAttemptMs = now
    inProgress = true
    run()
      .catch((err) => console.error(`${label} failed`, err))
      .finally(() => {
        inProgress = false
      })
  }
}
