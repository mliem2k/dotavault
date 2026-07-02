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
