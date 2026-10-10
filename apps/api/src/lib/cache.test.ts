import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '../db'
import { apiCache, parsedMatches } from '../db/schema'
import {
  cacheGet,
  cacheGetStale,
  cacheSet,
  deleteExpired,
  enforceSizeBudget,
  liveBytes,
} from './cache'

beforeEach(async () => {
  await db.delete(apiCache)
})

describe('cacheGet', () => {
  it('returns null when key does not exist', async () => {
    expect(await cacheGet('missing')).toBeNull()
  })

  it('returns data for a live entry', async () => {
    await cacheSet('k', { hello: 'world' }, 3600)
    expect(await cacheGet('k')).toEqual({ hello: 'world' })
  })

  it('returns null and removes an expired entry', async () => {
    await cacheSet('exp', { old: true }, -1)
    expect(await cacheGet('exp')).toBeNull()
    expect(await cacheGet('exp')).toBeNull() // second call also null (already deleted)
  })
})

describe('cacheGetStale', () => {
  it('returns null when key does not exist', async () => {
    expect(await cacheGetStale('missing')).toBeNull()
  })

  it('returns fresh data with stale: false for a live entry', async () => {
    await cacheSet('k', { hello: 'world' }, 3600)
    expect(await cacheGetStale('k')).toEqual({ data: { hello: 'world' }, stale: false })
  })

  it('returns expired data with stale: true instead of deleting it', async () => {
    await cacheSet('exp', { old: true }, -1)
    expect(await cacheGetStale('exp')).toEqual({ data: { old: true }, stale: true })
    // unlike cacheGet, the row is still there on a second read
    expect(await cacheGetStale('exp')).toEqual({ data: { old: true }, stale: true })
  })
})

describe('deleteExpired', () => {
  it('removes only expired entries', async () => {
    await cacheSet('live', { ok: true }, 3600)
    await cacheSet('dead', { ok: false }, -1)
    await deleteExpired()
    expect(await cacheGet('live')).toEqual({ ok: true })
    expect(await cacheGet('dead')).toBeNull()
  })
})

describe('enforceSizeBudget', () => {
  const blob = { pad: 'x'.repeat(20_000) }
  const rows = 120

  beforeEach(async () => {
    await db.delete(parsedMatches)
    await db.delete(apiCache)
  })

  it('leaves everything alone while under budget', async () => {
    await db.insert(parsedMatches).values({ matchId: 1, data: blob })
    await enforceSizeBudget((await liveBytes()) + 10_000_000)
    expect(await db.select().from(parsedMatches)).toHaveLength(1)
  })

  it('drops the oldest parsed matches first until the database fits', async () => {
    await db.insert(parsedMatches).values(
      Array.from({ length: rows }, (_, i) => ({
        matchId: i + 1,
        data: blob,
        createdAt: new Date((i + 1) * 1000),
      })),
    )
    const budget = (await liveBytes()) - 400_000
    await enforceSizeBudget(budget)
    expect(await liveBytes()).toBeLessThanOrEqual(budget)
    const left = (await db.select({ id: parsedMatches.matchId }).from(parsedMatches)).map(
      (r) => r.id,
    )
    expect(left).toContain(rows)
    expect(left).not.toContain(1)
    expect(left.length).toBeGreaterThan(rows / 2)
  })

  it('falls back to the oldest cache rows once no parsed matches are left', async () => {
    await db.insert(apiCache).values(
      Array.from({ length: rows }, (_, i) => ({
        key: `k${i + 1}`,
        data: blob,
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date((i + 1) * 1000),
      })),
    )
    const budget = (await liveBytes()) - 400_000
    await enforceSizeBudget(budget)
    expect(await liveBytes()).toBeLessThanOrEqual(budget)
    expect(await cacheGet(`k${rows}`)).not.toBeNull()
    expect(await cacheGet('k1')).toBeNull()
  })
})
