// Eden Treaty client for the dotavault API's /replay endpoints (apps/api),
// which serve self-parsed replay positions: cached in Postgres when the
// match was parsed before, otherwise parsed by the Go binary
// (apps/replay-parser) the API spawns as a subprocess. When the replay salt
// isn't known yet, the API orchestrates the whole pipeline itself (request
// an OpenDota parse, wait for the salt, parse), so the frontend only starts
// the job once and polls for status.

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

export type ReplayJobPhase = 'requesting_parse' | 'waiting_salt' | 'parsing' | 'failed' | 'gone'

export type ReplayStatus =
  | { kind: 'done'; result: ReplayPositions }
  | { kind: 'working'; phase: ReplayJobPhase }
  | { kind: 'failed'; phase: ReplayJobPhase; error: string }
  | { kind: 'none' }

function isResult(v: unknown): v is ReplayPositions {
  return typeof v === 'object' && v !== null && 'positions' in v
}

function toStatus(data: unknown, error: { status: unknown; value: unknown } | null): ReplayStatus {
  const body = (error?.value ?? data) as
    | ReplayPositions
    | { status?: ReplayJobPhase; error?: string }
    | null
  if (isResult(body)) return { kind: 'done', result: body }
  const phase = body && 'status' in body ? body.status : undefined
  if (phase === 'failed' || phase === 'gone') {
    return { kind: 'failed', phase, error: body?.error ?? 'replay parse failed' }
  }
  if (phase) return { kind: 'working', phase }
  return { kind: 'none' }
}

// Start (or re-attach to) the server-side parse job. Pass cluster/salt when
// the match already knows them so the server can skip the OpenDota wait.
export async function startReplayParse(
  matchId: number,
  cluster?: number | null,
  salt?: number | null,
): Promise<ReplayStatus> {
  const body = cluster != null && salt != null ? { cluster, salt } : undefined
  const { data, error } = await api.replay({ matchId: String(matchId) }).parse.post(body)
  return toStatus(data, error)
}

export async function getReplayStatus(matchId: number): Promise<ReplayStatus> {
  const { data, error } = await api.replay({ matchId: String(matchId) }).get()
  return toStatus(data, error)
}
