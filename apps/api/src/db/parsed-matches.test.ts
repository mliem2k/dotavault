import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from './index'
import { parsedMatches } from './schema'

beforeEach(async () => {
  await db.delete(parsedMatches)
})

describe('parsedMatches', () => {
  it('round-trips a row through the json data column', async () => {
    await db.insert(parsedMatches).values({
      matchId: 123,
      data: { match_id: 123, duration: 1800, players: {} },
    })
    const [row] = await db.select().from(parsedMatches)
    expect(row.matchId).toBe(123)
    expect(row.data).toEqual({ match_id: 123, duration: 1800, players: {} })
  })

  it('onConflictDoNothing leaves the original row untouched', async () => {
    await db.insert(parsedMatches).values({ matchId: 1, data: { match_id: 1 } })
    await db
      .insert(parsedMatches)
      .values({ matchId: 1, data: { match_id: 1, duration: 999 } })
      .onConflictDoNothing()
    const [row] = await db.select().from(parsedMatches)
    expect(row.data).toEqual({ match_id: 1 })
  })
})
