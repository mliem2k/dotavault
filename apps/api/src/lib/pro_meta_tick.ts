import type { PickBan, ProMetaResponse } from 'types'
import {
  createTickRunner,
  type FetchFn,
  fetchMatchDetailWithRetry,
  type IngestTickConfig,
  runIngestTick,
} from './ingest_tick'
import { fetchCached } from './opendota'
import {
  emptyProMetaTally,
  finalizeProMetaTally,
  foldMatchIntoTally,
  type MatchPlayerForLane,
  type ProMetaTally,
  proMetaResultKey,
} from './pro_meta'

// Minimal per-match fields foldMatchIntoTally needs. Fetched per match,
// folded into the running tally, then discarded; never persisted raw.
type CollectedMatch = {
  game_mode: number
  radiant_win: boolean
  picks_bans: PickBan[] | null
  players: MatchPlayerForLane[]
}

const LABEL = 'pro meta tick'
const TICK_BATCH_SIZE = 5

const config: IngestTickConfig<ProMetaTally, CollectedMatch, ProMetaResponse> = {
  label: LABEL,
  stateKey: (patchId) => `pro-meta-ingest:${patchId}`,
  resultKey: proMetaResultKey,
  batchSize: TICK_BATCH_SIZE,
  emptyTally: emptyProMetaTally,
  fetchDetail: (id, patchId, fetchFn) =>
    fetchMatchDetailWithRetry<CollectedMatch>(id, patchId, fetchFn, LABEL, (raw) => ({
      game_mode: raw.game_mode as number,
      radiant_win: raw.radiant_win as boolean,
      picks_bans: raw.picks_bans as PickBan[] | null,
      players: raw.players as MatchPlayerForLane[],
    })),
  fold: foldMatchIntoTally,
  buildResponse: ({ patch, tally, truncated }) => ({
    patch,
    totalMatches: tally.totalMatches,
    truncated,
    ...finalizeProMetaTally(tally),
  }),
}

export async function runProMetaTick(fetchFn: FetchFn = fetchCached): Promise<void> {
  await runIngestTick(config, fetchFn)
}

export const maybeRunProMetaTick = createTickRunner(LABEL, () => runProMetaTick())
