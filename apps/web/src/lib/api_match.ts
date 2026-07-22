// Eden Treaty client for the dotavault API's GET /matches/:id, which now
// merges our own parsed replay data (apps/replay-parser) with OpenDota's
// basic match fields. Follows pro_meta.ts's cold-start-retry pattern (apps/api
// scales to zero on Fly, so the first request after idle can transiently
// fail the gateway).

import { treaty } from '@elysiajs/eden'
import type { App } from 'api'
import type { Match } from 'types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const api = treaty<App>(BASE_URL)

const TRANSIENT_STATUSES = new Set([0, 502, 503, 504, 521, 522, 523, 524])

function isTransientStatus(status: unknown): boolean {
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status)
}

export async function fetchMatch(matchId: string): Promise<Match> {
  const attempts = 4
  const delayMs = 1500
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await api.matches({ id: matchId }).get()
    if (!error) return data as Match
    if (i === attempts - 1 || !isTransientStatus(error.status)) {
      throw new Error(`match API error: ${error.status}`)
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error('match API unreachable')
}

// A match is still being parsed if none of these parsed-only fields have
// shown up yet — matches how the endpoint itself signals "not done": it
// never wraps the response, absence of these fields IS the signal.
export function isFullyParsed(match: Match): boolean {
  return match.radiant_gold_adv != null && match.teamfights != null
}
