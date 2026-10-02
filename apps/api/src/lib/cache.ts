import { eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '../db'
import { apiCache, parsedMatches } from '../db/schema'

// The database must never grow past 1 GB. Turso blocks every write once the
// org storage cap is hit, which takes down every app sharing that org. SQLite
// never shrinks its file, but it reuses freed pages before growing, so bounding
// live pages (page_count - freelist_count) bounds the file. The margin under
// 1 GB absorbs the one insert that lands before its own trim runs.
export const MAX_DB_BYTES = 900 * 1024 * 1024
const EVICT_BATCH = 50

export async function liveBytes(): Promise<number> {
  const [row] = await db.all<{ bytes: number }>(
    sql`select (pc.page_count - fc.freelist_count) * ps.page_size as bytes
        from pragma_page_count() pc, pragma_freelist_count() fc, pragma_page_size() ps`,
  )
  return Number(row.bytes)
}

async function evictOldestParsedMatches(): Promise<number> {
  const oldest = db
    .select({ id: parsedMatches.matchId })
    .from(parsedMatches)
    .orderBy(parsedMatches.createdAt, parsedMatches.matchId)
    .limit(EVICT_BATCH)
  const gone = await db
    .delete(parsedMatches)
    .where(inArray(parsedMatches.matchId, oldest))
    .returning({ id: parsedMatches.matchId })
  return gone.length
}

async function evictOldestCacheRows(): Promise<number> {
  const oldest = db
    .select({ key: apiCache.key })
    .from(apiCache)
    .orderBy(apiCache.createdAt)
    .limit(EVICT_BATCH)
  const gone = await db
    .delete(apiCache)
    .where(inArray(apiCache.key, oldest))
    .returning({ key: apiCache.key })
  return gone.length
}

let trimming: Promise<void> | null = null

/**
 * Call after every insert. A no-op (one pragma read) while under budget; over
 * it, drops expired cache rows, then the oldest parsed matches, then the
 * oldest cache rows, until the database fits again.
 */
export function enforceSizeBudget(maxBytes = MAX_DB_BYTES): Promise<void> {
  trimming ??= (async () => {
    try {
      if ((await liveBytes()) <= maxBytes) return
      await deleteExpired()
      while ((await liveBytes()) > maxBytes) {
        const removed = (await evictOldestParsedMatches()) || (await evictOldestCacheRows())
        if (!removed) return
      }
    } finally {
      trimming = null
    }
  })()
  return trimming
}

export async function cacheGet(key: string): Promise<unknown | null> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!row) return null
  if (row.expiresAt < new Date()) {
    await db.delete(apiCache).where(eq(apiCache.key, key))
    return null
  }
  return row.data
}

export async function cacheGetStale(
  key: string,
): Promise<{ data: unknown; stale: boolean } | null> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!row) return null
  return { data: row.data, stale: row.expiresAt < new Date() }
}

export async function cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  await db
    .insert(apiCache)
    .values({ key, data, expiresAt })
    .onConflictDoUpdate({ target: apiCache.key, set: { data, expiresAt } })
  await enforceSizeBudget()
}

export async function deleteExpired(): Promise<void> {
  await db.delete(apiCache).where(lt(apiCache.expiresAt, new Date()))
}
