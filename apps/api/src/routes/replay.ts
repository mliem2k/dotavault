import { Elysia, t } from 'elysia'
import { currentJobStatus, getParsedMatch, startParseJob } from '../lib/parse_orchestrator'

/* HTTP wrapper around the parse orchestrator (apps/api/src/lib/parse_orchestrator.ts),
   which does the actual work: salt discovery, subprocess spawning, and the
   parse job state machine, caching results in the parsed_matches table
   (Turso/libsql). This file is temporary — Task 6 deletes it once the
   frontend moves to GET /matches/:id, which calls the orchestrator
   directly. */

export const replayPlugin = new Elysia({ prefix: '/replay' })
  .get(
    '/:matchId',
    async ({ params, set }) => {
      const matchId = Number(params.matchId)
      if (!Number.isInteger(matchId) || matchId <= 0) {
        set.status = 400
        return { error: 'invalid match id' }
      }
      const cached = await getParsedMatch(matchId)
      if (cached) return cached
      const job = currentJobStatus(matchId)
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
      const cached = await getParsedMatch(matchId)
      if (cached) return cached
      const cluster = Number(body?.cluster)
      const salt = Number(body?.salt)
      const hint =
        Number.isInteger(cluster) && cluster > 0 && Number.isInteger(salt) && salt > 0
          ? { cluster, salt }
          : undefined
      startParseJob(matchId, hint)
      const job = currentJobStatus(matchId)
      set.status = 202
      return { status: job?.phase ?? 'waiting_salt', error: job?.error }
    },
    {
      params: t.Object({ matchId: t.String() }),
      body: t.Optional(t.Object({ cluster: t.Optional(t.Number()), salt: t.Optional(t.Number()) })),
    },
  )
