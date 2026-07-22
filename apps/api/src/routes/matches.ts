import { Elysia, t } from 'elysia'
import type { Match } from 'types'
import { mergeParsedMatch, type ParsedMatch } from '../lib/match_merge'
import { fetchCached, fetchReplayInfo } from '../lib/opendota'
import { currentJobStatus, getParsedMatch, startParseJob } from '../lib/parse_orchestrator'

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

    if (!currentJobStatus(matchId)) {
      const info = await fetchReplayInfo(matchId).catch(() => null)
      startParseJob(matchId, info ? { cluster: info.cluster, salt: info.replay_salt } : undefined)
    }

    return mergeParsedMatch(basic, null)
  },
  { params: t.Object({ id: t.String() }) },
)
