import { describe, expect, test } from 'bun:test'
import type { ProDraftPairRow } from 'types'
import { partnerOf, topPartners, versusWinrateFor, worstMatchups } from './pair_math'

function row(
  heroA: number,
  heroB: number,
  together: { wins: number; sample: number },
  versus: { wins: number; sample: number },
): ProDraftPairRow {
  return { heroA, heroB, together, versus }
}

describe('partnerOf', () => {
  test('returns the other hero in the pair', () => {
    const r = row(3, 8, { wins: 0, sample: 0 }, { wins: 0, sample: 0 })
    expect(partnerOf(r, 3)).toBe(8)
    expect(partnerOf(r, 8)).toBe(3)
  })
})

describe('versusWinrateFor', () => {
  test('reads directly when asked about the lower hero id', () => {
    // Stored wins are always from heroA (the lower id) perspective.
    const r = row(3, 8, { wins: 0, sample: 0 }, { wins: 3, sample: 4 })
    expect(versusWinrateFor(r, 3)).toBe(0.75)
  })

  test('flips when asked about the higher hero id', () => {
    const r = row(3, 8, { wins: 0, sample: 0 }, { wins: 3, sample: 4 })
    expect(versusWinrateFor(r, 8)).toBe(0.25)
  })

  test('returns null with no games rather than a fake 0', () => {
    const r = row(3, 8, { wins: 0, sample: 0 }, { wins: 0, sample: 0 })
    expect(versusWinrateFor(r, 3)).toBeNull()
  })
})

describe('topPartners', () => {
  test('ranks by synergy winrate and drops pairs under the sample floor', () => {
    const rows = [
      row(1, 2, { wins: 9, sample: 10 }, { wins: 0, sample: 0 }),
      row(1, 3, { wins: 5, sample: 10 }, { wins: 0, sample: 0 }),
      // 100% but only 2 games: below the floor, must not appear.
      row(1, 4, { wins: 2, sample: 2 }, { wins: 0, sample: 0 }),
      // Does not involve hero 1 at all.
      row(5, 6, { wins: 10, sample: 10 }, { wins: 0, sample: 0 }),
    ]
    const result = topPartners(rows, 1, 5, 10)
    expect(result.map((r) => r.partner)).toEqual([2, 3])
    expect(result[0].winrate).toBe(0.9)
  })

  test('honours the limit', () => {
    const rows = [
      row(1, 2, { wins: 9, sample: 10 }, { wins: 0, sample: 0 }),
      row(1, 3, { wins: 8, sample: 10 }, { wins: 0, sample: 0 }),
      row(1, 4, { wins: 7, sample: 10 }, { wins: 0, sample: 0 }),
    ]
    expect(topPartners(rows, 1, 5, 2).map((r) => r.partner)).toEqual([2, 3])
  })
})

describe('worstMatchups', () => {
  test('ranks ascending by this hero winrate, flipping for the higher id', () => {
    const rows = [
      // Hero 5 is the higher id here, so its winrate is 1 - 8/10 = 0.2.
      row(1, 5, { wins: 0, sample: 0 }, { wins: 8, sample: 10 }),
      // Hero 5 is the lower id here, winrate 6/10 = 0.6.
      row(5, 9, { wins: 0, sample: 0 }, { wins: 6, sample: 10 }),
    ]
    const result = worstMatchups(rows, 5, 5, 10)
    expect(result.map((r) => r.partner)).toEqual([1, 9])
    expect(result[0].winrate).toBeCloseTo(0.2, 5)
  })
})
