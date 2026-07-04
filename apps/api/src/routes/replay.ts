import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../db'
import { replayPositions } from '../db/schema'
import { env } from '../lib/env'
import { fetchReplayInfo, requestOpendotaParse } from '../lib/opendota'

/* Self-parsed replay positions. The heavy lifting is a Go binary
   (apps/replay-parser) invoked as a subprocess: it downloads the .dem from
   Valve's CDN, parses it with manta, and prints the result as JSON on
   stdout. Results are cached in Postgres forever (replay files are
   immutable), so each match is parsed at most once.

   When the replay salt isn't known yet (OpenDota hasn't parsed the match),
   POST /replay/:matchId/parse orchestrates the whole pipeline server-side:
   request an OpenDota parse, poll until the salt appears, then run our own
   parser. The frontend asks once and polls GET for status; its polling also
   keeps this scale-to-zero machine awake while the job runs. */

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
export type ReplayParseResult = {
  match_id: number
  duration: number
  positions: Record<string, ReplayPoint[]>
}

type JobPhase = 'requesting_parse' | 'waiting_salt' | 'parsing' | 'failed' | 'gone'
type Job = { phase: JobPhase; error?: string; updatedAt: number }

// In-memory job state, fine for a single machine: if it restarts mid-job the
// frontend's next poll simply sees no job and can start over.
const jobs = new Map<number, Job>()
const FAILED_RETENTION_MS = 5 * 60 * 1000
const SALT_POLL_INTERVAL_MS = 20 * 1000
const SALT_POLL_DEADLINE_MS = 12 * 60 * 1000

let running = 0
const MAX_CONCURRENT_PARSES = 2

class ReplayGoneError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function setJob(matchId: number, phase: JobPhase, error?: string) {
  jobs.set(matchId, { phase, error, updatedAt: Date.now() })
}

function currentJob(matchId: number): Job | null {
  const job = jobs.get(matchId)
  if (!job) return null
  // Let failed/gone states expire so a later retry can start fresh.
  if ((job.phase === 'failed' || job.phase === 'gone') && Date.now() - job.updatedAt > FAILED_RETENTION_MS) {
    jobs.delete(matchId)
    return null
  }
  return job
}

async function runParser(matchId: number, cluster: number, salt: number): Promise<ReplayParseResult> {
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
  await db.insert(replayPositions).values({ matchId, data: result }).onConflictDoNothing()
  jobs.delete(matchId)
}

async function orchestrate(matchId: number, hint?: { cluster: number; salt: number }): Promise<void> {
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

async function getCached(matchId: number): Promise<ReplayParseResult | null> {
  const [row] = await db
    .select({ data: replayPositions.data })
    .from(replayPositions)
    .where(eq(replayPositions.matchId, matchId))
  return row ? (row.data as ReplayParseResult) : null
}

export const replayPlugin = new Elysia({ prefix: '/replay' })
  .get(
    '/:matchId',
    async ({ params, set }) => {
      const matchId = Number(params.matchId)
      if (!Number.isInteger(matchId) || matchId <= 0) {
        set.status = 400
        return { error: 'invalid match id' }
      }

      const cached = await getCached(matchId)
      if (cached) return cached

      const job = currentJob(matchId)
      if (job) {
        set.status = job.phase === 'failed' || job.phase === 'gone' ? 502 : 202
        return { status: job.phase, error: job.error }
      }

      set.status = 404
      return { error: 'not parsed' }
    },
    { params: t.Object({ matchId: t.String() }) },
  )
  .post(
    '/:matchId/parse',
    async ({ params, body, set }) => {
      const matchId = Number(params.matchId)
      if (!Number.isInteger(matchId) || matchId <= 0) {
        set.status = 400
        return { error: 'invalid match id' }
      }

      const cached = await getCached(matchId)
      if (cached) return cached

      let job = currentJob(matchId)
      if (!job) {
        const cluster = Number(body?.cluster)
        const salt = Number(body?.salt)
        const hint =
          Number.isInteger(cluster) && cluster > 0 && Number.isInteger(salt) && salt > 0
            ? { cluster, salt }
            : undefined
        setJob(matchId, hint ? 'parsing' : 'waiting_salt')
        // Fire and forget: the frontend follows along by polling GET.
        void orchestrate(matchId, hint)
        job = currentJob(matchId)
      }

      set.status = 202
      return { status: job?.phase ?? 'waiting_salt', error: job?.error }
    },
    {
      params: t.Object({ matchId: t.String() }),
      body: t.Optional(t.Object({ cluster: t.Optional(t.Number()), salt: t.Optional(t.Number()) })),
    },
  )
