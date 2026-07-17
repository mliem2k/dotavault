import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const apiCache = sqliteTable('api_cache', {
  key: text('key').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// Self-parsed replay position data (from apps/replay-parser). A replay file
// never changes after the match ends, so entries never expire: each match is
// parsed at most once, ever.
export const replayPositions = sqliteTable('replay_positions', {
  matchId: integer('match_id', { mode: 'number' }).primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
