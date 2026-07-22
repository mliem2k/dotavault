import { eq } from 'drizzle-orm'
import { db } from '../db'
import { parsedMatches } from '../db/schema'
import { env } from './env'
import { fetchReplayInfo, requestOpendotaParse } from './opendota'

/* Self-parsed replay data. The heavy lifting is a Go binary
   (apps/replay-parser) invoked as a subprocess: it downloads the .dem from
   Valve's CDN, parses it with manta, and prints the result as JSON on
   stdout. Results are cached in the parsed_matches table (Turso/libsql)
   forever (replay files are immutable), so each match is parsed at most
   once.

   When the replay salt isn't known yet (OpenDota hasn't parsed the match),
   startParseJob orchestrates the whole pipeline server-side: request an
   OpenDota parse, poll until the salt appears, then run our own parser.
   Callers poll currentJobStatus for status; that polling also keeps this
   scale-to-zero machine awake while the job runs. */

export type ReplayPoint = {
  t: number
  x: number
  y: number
  lvl: number
  hp: number
  mhp: number
  mp: number
  mmp: number
}
export type ReplayKill = {
  t: number
  attacker: string
  victim: string
  inflictor?: string
  gold?: number
}
export type ReplayParseResult = {
  match_id: number
  duration: number
  positions: Record<string, ReplayPoint[]>
  kills?: ReplayKill[]
}

export type JobPhase = 'requesting_parse' | 'waiting_salt' | 'parsing' | 'failed' | 'gone'
export type Job = { phase: JobPhase; error?: string; updatedAt: number }

// In-memory job state, fine for a single machine: if it restarts mid-job the
// caller's next poll simply sees no job and can start over.
const jobs = new Map<number, Job>()
const FAILED_RETENTION_MS = 5 * 60 * 1000
const SALT_POLL_INTERVAL_MS = 20 * 1000
// OpenDota's parse queue was observed taking 15+ minutes on a cold match.
const SALT_POLL_DEADLINE_MS = 25 * 60 * 1000

let running = 0
const MAX_CONCURRENT_PARSES = 2

class ReplayGoneError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function setJob(matchId: number, phase: JobPhase, error?: string) {
  jobs.set(matchId, { phase, error, updatedAt: Date.now() })
}

export function currentJobStatus(matchId: number): Job | null {
  const job = jobs.get(matchId)
  if (!job) return null
  // Let failed/gone states expire so a later retry can start fresh.
  if (
    (job.phase === 'failed' || job.phase === 'gone') &&
    Date.now() - job.updatedAt > FAILED_RETENTION_MS
  ) {
    jobs.delete(matchId)
    return null
  }
  return job
}

async function runParser(
  matchId: number,
  cluster: number,
  salt: number,
): Promise<ReplayParseResult> {
  running++
  try {
    const proc = Bun.spawn(
      [env.REPLAY_PARSER_BIN, '-remote', String(matchId), String(cluster), String(salt)],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const [out, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    if (exitCode === 4) throw new ReplayGoneError()
    if (exitCode !== 0) {
      let message = 'replay parse failed'
      try {
        message = (JSON.parse(out) as { error?: string }).error ?? message
      } catch {}
      throw new Error(message)
    }
    return JSON.parse(out) as ReplayParseResult
  } finally {
    running--
  }
}

async function parseAndStore(matchId: number, cluster: number, salt: number): Promise<void> {
  setJob(matchId, 'parsing')
  // The parser cap protects memory; wait for a slot instead of failing.
  while (running >= MAX_CONCURRENT_PARSES) await sleep(5000)
  const result = await runParser(matchId, cluster, salt)
  await db.insert(parsedMatches).values({ matchId, data: result }).onConflictDoNothing()
  jobs.delete(matchId)
}

async function orchestrate(
  matchId: number,
  hint?: { cluster: number; salt: number },
): Promise<void> {
  try {
    if (hint) {
      await parseAndStore(matchId, hint.cluster, hint.salt)
      return
    }

    setJob(matchId, 'waiting_salt')
    let info = await fetchReplayInfo(matchId)

    if (!info) {
      setJob(matchId, 'requesting_parse')
      await requestOpendotaParse(matchId)
      setJob(matchId, 'waiting_salt')
      const deadline = Date.now() + SALT_POLL_DEADLINE_MS
      while (!info && Date.now() < deadline) {
        await sleep(SALT_POLL_INTERVAL_MS)
        info = await fetchReplayInfo(matchId)
      }
      if (!info) throw new Error('timed out waiting for OpenDota to learn the replay salt')
    }

    await parseAndStore(matchId, info.cluster, info.replay_salt)
  } catch (err) {
    if (err instanceof ReplayGoneError) {
      setJob(matchId, 'gone', "replay is no longer available on Valve's CDN")
    } else {
      setJob(matchId, 'failed', err instanceof Error ? err.message : 'replay parse failed')
    }
  }
}

// Reserves the job synchronously, before any await, so two concurrent
// callers for the same match can't both see "no job" and both start an
// orchestration.
export function startParseJob(matchId: number, hint?: { cluster: number; salt: number }): void {
  if (currentJobStatus(matchId)) return // already running or recently failed/gone
  setJob(matchId, hint ? 'parsing' : 'waiting_salt')
  void orchestrate(matchId, hint) // fire-and-forget; caller polls currentJobStatus
}

export async function getParsedMatch(matchId: number): Promise<unknown | null> {
  const [row] = await db
    .select({ data: parsedMatches.data })
    .from(parsedMatches)
    .where(eq(parsedMatches.matchId, matchId))
  return row ? row.data : null
}
