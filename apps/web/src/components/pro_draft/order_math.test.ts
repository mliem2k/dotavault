import { describe, expect, test } from 'bun:test'
import { averageOrder, bucketTotal, sortNullsLast } from './order_math'

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

describe('sortNullsLast', () => {
  test('ascending: rows with data ascend, no-data rows come after them', () => {
    const rows = [
      { id: 'c', value: 10 },
      { id: 'a', value: 2 },
      { id: 'b', value: null as number | null },
    ]
    const sorted = sortNullsLast(rows, 'asc', (r) => r.value)
    expect(sorted.map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  test('descending: rows with data descend, no-data rows still come after them', () => {
    // This is the assertion that would have caught the original bug: the
    // old comparator sorted ascending with null mapped to +Infinity, then
    // reversed the whole array, which put the no-data row first instead of
    // last.
    const rows = [
      { id: 'a', value: 2 },
      { id: 'b', value: null as number | null },
      { id: 'c', value: 10 },
    ]
    const sorted = sortNullsLast(rows, 'desc', (r) => r.value)
    expect(sorted.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  test('a row with data for one column but not the other lands correctly when each column is the active sort', () => {
    const rows = [
      { id: 'onlyBan', avgBan: 3, avgPick: null as number | null },
      { id: 'onlyPick', avgBan: null as number | null, avgPick: 7 },
      { id: 'both', avgBan: 1, avgPick: 1 },
    ]

    const byBan = sortNullsLast(rows, 'asc', (r) => r.avgBan)
    expect(byBan.map((r) => r.id)).toEqual(['both', 'onlyBan', 'onlyPick'])

    const byPick = sortNullsLast(rows, 'asc', (r) => r.avgPick)
    expect(byPick.map((r) => r.id)).toEqual(['both', 'onlyPick', 'onlyBan'])
  })
})
