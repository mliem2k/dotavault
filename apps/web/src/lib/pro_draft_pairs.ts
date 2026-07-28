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

// Returns as soon as the status is non-transient (or attempts run out),
// never throws from inside the loop. That makes "retry only transient
// failures" true by construction: the caller inspects the returned error
// exactly once, after the loop, instead of a throw racing a sibling catch.
async function withColdStartRetry<_T>(
  call: () => Promise<{ data: unknown; error: { status: unknown; value: unknown } | null }>,
  attempts = 4,
  delayMs = 1500,
): Promise<{ data: unknown; error: { status: unknown; value: unknown } | null }> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await call()
      if (i === attempts - 1 || !isTransientStatus(res.error?.status)) return res
    } catch {
      if (i === attempts - 1) throw new Error('pro draft pairs API unreachable')
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return { data: null, error: null }
}

// 503 (still computing) surfaces as a thrown error here too, intentionally,
// so a single useQuery isError branch covers both "genuinely down" and
// "first computation still running".
export async function fetchProDraftPairs(): Promise<ProDraftPairsResponse> {
  const { data, error } = await withColdStartRetry(() => api.pro['draft-pairs'].get())
  if (error) {
    const value = error.value
    const message =
      value && typeof value === 'object' && 'error' in value
        ? String((value as { error: string }).error)
        : 'pro draft pairs unavailable'
    throw new Error(message)
  }
  if (!data) throw new Error('pro draft pairs unavailable')
  return data as ProDraftPairsResponse
}
