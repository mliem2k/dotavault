import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const apiCache = sqliteTable('api_cache', {
  key: text('key').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// Self-parsed match data (from apps/replay-parser's ParsedMatch output). A
// replay file never changes after the match ends, so entries have no TTL and a
// match is parsed once. They are only dropped oldest first by
// enforceSizeBudget (lib/cache.ts) when the database nears 1 GB. Replaces the older
// positions-only replay_positions table now that apps/replay-parser
// produces the full parsed-match blob, not just positions.
export const parsedMatches = sqliteTable('parsed_matches', {
  matchId: integer('match_id', { mode: 'number' }).primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})
