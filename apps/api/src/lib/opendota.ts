import { env } from './env'
import { cacheGet, cacheSet } from './cache'

const BASE = 'https://api.opendota.com/api'

async function fetchOpenDota(path: string): Promise<unknown> {
  let url = `${BASE}${path}`
  if (env.OPENDOTA_API_KEY) {
    const sep = url.includes('?') ? '&' : '?'
    url += `${sep}api_key=${env.OPENDOTA_API_KEY}`
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenDota ${path} → ${res.status}`)
  return res.json()
}

export async function fetchCached(path: string, ttlSeconds: number): Promise<unknown> {
  const key = `opendota:${path}`
  const cached = await cacheGet(key)
  if (cached !== null) return cached
  const data = await fetchOpenDota(path)
  await cacheSet(key, data, ttlSeconds)
  return data
}

/* --------- replay-parse orchestration helpers (uncached) --------- */

export type ReplayInfo = { match_id: number; cluster: number; replay_salt: number }

// Replay cluster + salt for a match, or null while OpenDota doesn't know it
// yet (it learns the salt from Valve's game coordinator during a parse).
export async function fetchReplayInfo(matchId: number): Promise<ReplayInfo | null> {
  try {
    const rows = (await fetchOpenDota(`/replays?match_id=${matchId}`)) as ReplayInfo[]
    const row = Array.isArray(rows) ? rows[0] : null
    if (row && row.cluster > 0 && row.replay_salt != null && row.replay_salt !== 0) return row
    return null
  } catch {
    return null
  }
}

export async function requestOpendotaParse(matchId: number): Promise<void> {
  let url = `${BASE}/request/${matchId}`
  if (env.OPENDOTA_API_KEY) url += `?api_key=${env.OPENDOTA_API_KEY}`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) throw new Error(`OpenDota parse request failed (${res.status})`)
}
