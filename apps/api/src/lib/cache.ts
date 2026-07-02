import { eq, lt } from 'drizzle-orm'
import { db } from '../db'
import { apiCache } from '../db/schema'

export async function cacheGet(key: string): Promise<unknown | null> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!row) return null
  if (row.expiresAt < new Date()) {
    await db.delete(apiCache).where(eq(apiCache.key, key))
    return null
  }
  return row.data
}

export async function cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  await db
    .insert(apiCache)
    .values({ key, data, expiresAt })
    .onConflictDoUpdate({ target: apiCache.key, set: { data, expiresAt } })
}

export async function deleteExpired(): Promise<void> {
  await db.delete(apiCache).where(lt(apiCache.expiresAt, new Date()))
}
