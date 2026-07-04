import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../db'
import { replayPositions } from '../db/schema'
import { env } from '../lib/env'

/* Self-parsed replay positions. The heavy lifting is a Go binary
   (apps/replay-parser) invoked as a subprocess: it downloads the .dem from
   Valve's CDN, parses it with manta, and prints the result as JSON on
   stdout. Results are cached in Postgres forever (replay files are
   immutable), so each match is parsed at most once. */

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

// Concurrent requests for the SAME match share one parse; a global cap keeps
// a burst of different matches from exhausting the VM's memory (each parse
// briefly holds manta's full entity state).
const inFlight = new Map<number, Promise<ReplayParseResult>>()
let running = 0
const MAX_CONCURRENT_PARSES = 2

class ReplayGoneError extends Error {}
class ParserBusyError extends Error {}

async function runParser(matchId: number, cluster: number, salt: number): Promise<ReplayParseResult> {
  if (running >= MAX_CONCURRENT_PARSES) throw new ParserBusyError()
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

export const replayPlugin = new Elysia({ prefix: '/replay' }).get(
  '/:matchId',
  async ({ params, query, set }) => {
    const matchId = Number(params.matchId)
    if (!Number.isInteger(matchId) || matchId <= 0) {
      set.status = 400
      return { error: 'invalid match id' }
    }

    const [cached] = await db
      .select({ data: replayPositions.data })
      .from(replayPositions)
      .where(eq(replayPositions.matchId, matchId))
    if (cached) return cached.data as ReplayParseResult

    const cluster = Number(query.cluster)
    const salt = Number(query.salt)
    if (!Number.isInteger(cluster) || cluster <= 0 || !Number.isInteger(salt) || salt <= 0) {
      set.status = 400
      return { error: 'cluster and salt are required to parse a match for the first time' }
    }

    try {
      let job = inFlight.get(matchId)
      if (!job) {
        job = runParser(matchId, cluster, salt).then(async (result) => {
          await db
            .insert(replayPositions)
            .values({ matchId, data: result })
            .onConflictDoNothing()
          return result
        })
        inFlight.set(matchId, job)
        job.finally(() => inFlight.delete(matchId))
      }
      return await job
    } catch (err) {
      if (err instanceof ReplayGoneError) {
        set.status = 404
        return { error: "replay is no longer available on Valve's CDN" }
      }
      if (err instanceof ParserBusyError) {
        set.status = 429
        return { error: 'parser is busy, try again shortly' }
      }
      set.status = 502
      return { error: err instanceof Error ? err.message : 'replay parse failed' }
    }
  },
  {
    params: t.Object({ matchId: t.String() }),
    query: t.Object({ cluster: t.Optional(t.String()), salt: t.Optional(t.String()) }),
  },
)
