// Eden Treaty client for the dotavault API's /replay endpoint (apps/api),
// which serves self-parsed replay positions: cached in Postgres when the
// match was parsed before, otherwise parsed on demand by the Go binary
// (apps/replay-parser) the API spawns as a subprocess. First-time parses
// only work while Valve's CDN still serves the replay file.

import { treaty } from '@elysiajs/eden'
import type { App } from 'api'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const api = treaty<App>(BASE_URL)

export type PositionPoint = {
  t: number
  x: number
  y: number
  lvl: number
  hp: number
  mhp: number
  mp: number
  mmp: number
}
export type ReplayPositions = {
  match_id: number
  duration: number
  positions: Record<string, PositionPoint[]>
}

export class ReplayUnavailableError extends Error {}

export async function parseReplayPositions(
  matchId: number,
  cluster: number,
  replaySalt: number,
): Promise<ReplayPositions> {
  const { data, error } = await api.replay({ matchId: String(matchId) }).get({
    query: { cluster: String(cluster), salt: String(replaySalt) },
  })
  if (error) {
    // Runtime statuses (404/429/502 set via set.status) are wider than the
    // union Elysia infers, which only sees the 422 validation case.
    if ((error.status as number) === 404) {
      throw new ReplayUnavailableError("Replay is no longer available on Valve's CDN")
    }
    const message =
      typeof error.value === 'object' && error.value && 'error' in error.value
        ? String((error.value as { error: unknown }).error)
        : `replay request failed (${error.status})`
    throw new Error(message)
  }
  if (!data || typeof data !== 'object' || !('positions' in data)) {
    throw new Error('unexpected replay response')
  }
  return data as ReplayPositions
}
