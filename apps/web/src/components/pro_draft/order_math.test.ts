import { describe, expect, test } from 'bun:test'
import { averageOrder, bucketTotal } from './order_math'

describe('averageOrder', () => {
  test('returns null for no data, so the UI can show a placeholder', () => {
    expect(averageOrder([])).toBeNull()
  })

  test('tolerates a missing field from an API that predates order buckets', () => {
    // CI auto-deploys the frontend but the API is deployed manually, so a new
    // frontend provably runs against an older API for some window. Rows from
    // that API have no pickOrder/banOrder at all.
    expect(averageOrder(undefined)).toBeNull()
  })

  test('averages a single slot to that slot', () => {
    expect(averageOrder([{ order: 6, count: 3 }])).toBe(6)
  })

  test('weights each slot by how often it occurred', () => {
    // Three picks at order 2, one at order 10: (2*3 + 10) / 4 = 4.
    expect(
      averageOrder([
        { order: 2, count: 3 },
        { order: 10, count: 1 },
      ]),
    ).toBe(4)
  })
})

describe('bucketTotal', () => {
  test('sums counts across slots', () => {
    expect(
      bucketTotal([
        { order: 1, count: 2 },
        { order: 5, count: 3 },
      ]),
    ).toBe(5)
  })

  test('is zero for no data', () => {
    expect(bucketTotal([])).toBe(0)
  })

  test('tolerates a missing field from an older API', () => {
    expect(bucketTotal(undefined)).toBe(0)
  })
})
