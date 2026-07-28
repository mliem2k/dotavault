// Eden Treaty client for the dotavault API's GET /pro/draft-pairs. Follows
// pro_meta.ts's cold-start-retry pattern (apps/api scales to zero on Fly, so
// the first request after idle can transiently fail the gateway).

import { treaty } from '@elysiajs/eden'
import type { App } from 'api'
import type { ProDraftPairsResponse } from 'types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const api = treaty<App>(BASE_URL)

const TRANSIENT_STATUSES = new Set([0, 502, 503, 504, 521, 522, 523, 524])

function isTransientStatus(status: unknown): boolean {
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status)
}

// 503 (still computing) surfaces as a thrown error here too, intentionally,
// so a single useQuery isError branch covers both "genuinely down" and
// "first computation still running".
export async function fetchProDraftPairs(): Promise<ProDraftPairsResponse> {
  const attempts = 4
  const delayMs = 1500
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await api.pro['draft-pairs'].get()
      if (!error) return data as ProDraftPairsResponse
      if (i === attempts - 1 || !isTransientStatus(error.status)) {
        const value = error.value
        const message =
          value && typeof value === 'object' && 'error' in value
            ? String((value as { error: string }).error)
            : 'pro draft pairs unavailable'
        throw new Error(message)
      }
    } catch (err) {
      if (i === attempts - 1)
        throw err instanceof Error ? err : new Error('pro draft pairs unreachable')
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error('pro draft pairs unavailable')
}
