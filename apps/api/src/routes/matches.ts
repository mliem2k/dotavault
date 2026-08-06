import { Elysia, t } from 'elysia'
import type { Match } from 'types'
import { mergeParsedMatch, type ParsedMatch } from '../lib/match_merge'
import { fetchCached, fetchReplayInfo } from '../lib/opendota'
import {
  currentJobStatus,
  getParsedMatch,
  replayExpired,
  startParseJob,
} from '../lib/parse_orchestrator'

/* The orchestration entry point: merges our own parsed replay data (Go
   parser output, cached in the parsed_matches table) onto OpenDota's basic
   match fields. Always returns a plain Match — never a status envelope —
   so the response shape is stable whether or not our parse has finished
   yet. If nothing's parsed and no job is already running for this match,
   kicks off a background parse (best-effort salt hint from OpenDota) and
   returns the basic fields alone; the frontend distinguishes "still
   parsing" from "done" by checking for a parsed-only field's presence. */
export const matchesPlugin = new Elysia({ prefix: '/matches' }).get(
  '/:id',
  async ({ params, set }) => {
    const matchId = Number(params.id)
    if (!Number.isInteger(matchId) || matchId <= 0) {
      set.status = 400
      return { error: 'invalid match id' }
    }

    const basic = (await fetchCached(`/matches/${params.id}`, 60 * 60 * 24)) as Match

    const parsed = (await getParsedMatch(matchId)) as ParsedMatch | null
    if (parsed) return mergeParsedMatch(basic, parsed)

    // Old enough that Valve's CDN has certainly dropped the replay: report
    // it as unavailable without touching the network, so neither the client
    // nor the parse queue keeps chasing a file that no longer exists.
    if (replayExpired(basic.start_time, basic.duration)) {
      return { ...mergeParsedMatch(basic, null), replay_status: 'unavailable' as const }
    }

    let job = currentJobStatus(matchId)
    if (!job) {
      const info = await fetchReplayInfo(matchId).catch(() => null)
      startParseJob(matchId, info ? { cluster: info.cluster, salt: info.replay_salt } : undefined)
      job = currentJobStatus(matchId)
    }

    // 'failed' counts as unavailable too: it stops the client polling for a
    // parse that already gave up, while the server still lets the job state
    // expire, so simply revisiting the page retries once. Reporting it as
    // 'parsing' instead would have the client re-request every 15s and start
    // a fresh 25-minute orchestration on every expiry, forever.
    const terminal = job?.phase === 'gone' || job?.phase === 'failed'
    return {
      ...mergeParsedMatch(basic, null),
      replay_status: terminal ? ('unavailable' as const) : ('parsing' as const),
    }
  },
  { params: t.Object({ id: t.String() }) },
)
