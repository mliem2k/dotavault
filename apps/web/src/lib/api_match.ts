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

// A match is still being parsed if our own parser hasn't landed yet. This
// deliberately checks `kills`, not fields like `radiant_gold_adv`/
// `teamfights`: those mirror OpenDota's own schema, so OpenDota can
// populate them independently once *its* parse completes, well before our
// own parse does for the same match — checking them would stop polling
// on OpenDota's data and never pick up our own (richer, since-corrected)
// version. `kills` (and per-player `positions`) exist only because our own
// Go parser adds them; OpenDota's API never returns either under this
// shape (that's exactly why the old codebase needed a separate manual
// pipeline just to fetch positions), so seeing it populated is a reliable
// signal that /matches/:id's merge has actually run.
export function isFullyParsed(match: Match): boolean {
  return match.kills != null
}
