import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from './index'
import { replayPositions } from './schema'

beforeEach(async () => {
  await db.delete(replayPositions)
})

describe('replayPositions', () => {
  it('round-trips a row through the json data column', async () => {
    await db.insert(replayPositions).values({
      matchId: 123,
      data: { match_id: 123, duration: 1800, positions: {} },
    })
    const [row] = await db.select().from(replayPositions)
    expect(row.matchId).toBe(123)
    expect(row.data).toEqual({ match_id: 123, duration: 1800, positions: {} })
  })

  it('onConflictDoNothing leaves the original row untouched', async () => {
    await db.insert(replayPositions).values({ matchId: 1, data: { match_id: 1 } })
    await db
      .insert(replayPositions)
      .values({ matchId: 1, data: { match_id: 1, duration: 999 } })
      .onConflictDoNothing()
    const [row] = await db.select().from(replayPositions)
    expect(row.data).toEqual({ match_id: 1 })
  })
})
