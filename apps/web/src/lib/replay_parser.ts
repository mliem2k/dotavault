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
export type ParsedKill = {
  t: number
  attacker: string
  victim: string
  inflictor?: string
  gold?: number
}
export type ReplayPositions = {
  match_id: number
  duration: number
  positions: Record<string, PositionPoint[]>
  // Combat-log kill details; absent on parses stored before this existed.
  kills?: ParsedKill[]
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

// The API scales to zero when idle (Fly.io min_machines_running: 0), so the
// first request after a quiet period wakes a stopped machine, which took
// ~6s in testing. Cloudflare's proxy can give up on that wait and return a
// 521/522 (or the fetch can throw outright) before the machine is actually
// up, so a request that fails this way almost always succeeds a couple
// seconds later once the machine has finished booting from the first
// attempt. Genuine 4xx-style API responses aren't retried, only the
// gateway/network failures a cold start produces.
const TRANSIENT_STATUSES = new Set([0, 502, 503, 504, 521, 522, 523, 524])

function isTransientStatus(status: unknown): boolean {
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status)
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

async function withColdStartRetry<T>(
  call: () => Promise<{ data: unknown; error: { status: unknown; value: unknown } | null }>,
  attempts = 4,
  delayMs = 1500,
): Promise<{ data: unknown; error: { status: unknown; value: unknown } | null }> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await call()
      if (i === attempts - 1 || !isTransientStatus(res.error?.status)) return res
    } catch {
      if (i === attempts - 1) throw new Error('replay API unreachable')
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  // Unreachable, the loop above always returns or throws on the last attempt.
  return { data: null, error: null }
}

// Start (or re-attach to) the server-side parse job. Pass cluster/salt when
// the match already knows them so the server can skip the OpenDota wait.
export async function startReplayParse(
  matchId: number,
  cluster?: number | null,
  salt?: number | null,
): Promise<ReplayStatus> {
  const body = cluster != null && salt != null ? { cluster, salt } : undefined
  const { data, error } = await withColdStartRetry(() =>
    api.replay({ matchId: String(matchId) }).parse.post(body),
  )
  return toStatus(data, error)
}

export async function getReplayStatus(matchId: number): Promise<ReplayStatus> {
  const { data, error } = await withColdStartRetry(() =>
    api.replay({ matchId: String(matchId) }).get(),
  )
  return toStatus(data, error)
}
