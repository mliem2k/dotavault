import type { PickBan, ProDraftPairsResponse } from 'types'
import {
  createTickRunner,
  type FetchFn,
  fetchMatchDetailWithRetry,
  type IngestTickConfig,
  runIngestTick,
} from './ingest_tick'
import { fetchCached } from './opendota'
import {
  emptyPairTally,
  finalizePairTally,
  foldMatchIntoPairTally,
  type ProDraftPairTally,
  proDraftPairsResultKey,
} from './pro_draft_pairs'

// Only the fields foldMatchIntoPairTally needs. Unlike the meta tick this
// needs no game_mode: pairs are meaningful in any drafted mode.
type CollectedMatch = {
  radiant_win: boolean
  picks_bans: PickBan[] | null
}

const LABEL = 'pro draft pairs tick'

// Larger than the meta tick's 5. The persisted pair tally is a few hundred
// KB against pro-meta's few KB, so the goal is fewer, larger writes rather
// than more, smaller ones. Note this is not free: both ticks walk the same
// ordered candidate list, and at 4x the meta tick's batch size this pipeline
// consumes ids faster and runs ahead of it, so its per-match detail fetches
// are typically the ones that are cold, not reused from the meta tick's
// cache. That extra request volume is acceptable because production has an
// OPENDOTA_API_KEY configured, which lifts the free-tier rate limit.
const TICK_BATCH_SIZE = 20

const config: IngestTickConfig<ProDraftPairTally, CollectedMatch, ProDraftPairsResponse> = {
  label: LABEL,
  stateKey: (patchId) => `pro-draft-pairs-ingest:${patchId}`,
  resultKey: proDraftPairsResultKey,
  batchSize: TICK_BATCH_SIZE,
  emptyTally: emptyPairTally,
  fetchDetail: (id, patchId, fetchFn) =>
    fetchMatchDetailWithRetry<CollectedMatch>(id, patchId, fetchFn, LABEL, (raw) => ({
      radiant_win: raw.radiant_win as boolean,
      picks_bans: raw.picks_bans as PickBan[] | null,
    })),
  fold: foldMatchIntoPairTally,
  buildResponse: ({ patch, tally, truncated }) => ({
    patch,
    totalMatches: tally.totalMatches,
    truncated,
    pairs: finalizePairTally(tally),
  }),
}

export async function runProDraftPairsTick(fetchFn: FetchFn = fetchCached): Promise<void> {
  await runIngestTick(config, fetchFn)
}

export const maybeRunProDraftPairsTick = createTickRunner(LABEL, () => runProDraftPairsTick())
