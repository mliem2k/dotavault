// Eden Treaty client for the dotavault API's GET /pro/meta endpoint. Follows
// replay_parser.ts's cold-start-retry pattern (apps/api scales to zero on
// Fly, so the first request after idle can transiently fail the gateway).

import { treaty } from '@elysiajs/eden'
import type { App } from 'api'
import type { ProMetaResponse } from 'types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const api = treaty<App>(BASE_URL)

const TRANSIENT_STATUSES = new Set([0, 502, 503, 504, 521, 522, 523, 524])

function isTransientStatus(status: unknown): boolean {
  return typeof status === 'number' && TRANSIENT_STATUSES.has(status)
}

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
      if (i === attempts - 1) throw new Error('pro meta API unreachable')
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return { data: null, error: null }
}

// 503 (still computing) surfaces as a thrown error here too — intentional,
// so a single useQuery isError branch in pro_meta_view.tsx covers both
// "genuinely down" and "first computation still running".
export async function fetchProMeta(): Promise<ProMetaResponse> {
  const { data, error } = await withColdStartRetry(() => api.pro.meta.get())
  if (error) {
    const value = error.value
    const message =
      value && typeof value === 'object' && 'error' in value
        ? String((value as { error: string }).error)
        : 'pro meta unavailable'
    throw new Error(message)
  }
  if (!data) throw new Error('pro meta unavailable')
  return data as ProMetaResponse
}
