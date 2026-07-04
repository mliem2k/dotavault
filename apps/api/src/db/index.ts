import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { apiCache, replayPositions } from './schema'
import { env } from '../lib/env'

const client = postgres(env.DATABASE_URL, { max: 5 })
export const db = drizzle(client, { schema: { apiCache, replayPositions } })
export type DB = typeof db
