import { bigint, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const apiCache = pgTable('api_cache', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Self-parsed replay position data (from apps/replay-parser). A replay file
// never changes after the match ends, so entries never expire: each match is
// parsed at most once, ever.
export const replayPositions = pgTable('replay_positions', {
  matchId: bigint('match_id', { mode: 'number' }).primaryKey(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
