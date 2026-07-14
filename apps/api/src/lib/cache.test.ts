import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '../db'
import { apiCache } from '../db/schema'
import { cacheGet, cacheGetStale, cacheSet, deleteExpired } from './cache'

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
