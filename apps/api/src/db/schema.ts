import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const apiCache = pgTable('api_cache', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
