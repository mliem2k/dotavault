import { describe, expect, test } from 'bun:test'
import { aggregateScenarioWinRates } from './scenario_aggregation'

describe('aggregateScenarioWinRates', () => {
  test('sums games and wins across region and side for the same scenario', () => {
    const rows = [
      { scenario: 'first_blood', is_radiant: true, region: 1, games: '100', wins: '60' },
      { scenario: 'first_blood', is_radiant: false, region: 2, games: '50', wins: '20' },
      { scenario: 'courier_kill', is_radiant: true, region: 1, games: '10', wins: '7' },
    ]
    const result = aggregateScenarioWinRates(rows)

    expect(result).toHaveLength(2)
    const firstBlood = result.find((r) => r.scenario === 'first_blood')
    expect(firstBlood?.games).toBe(150)
    expect(firstBlood?.wins).toBe(80)
    expect(firstBlood?.winRate).toBeCloseTo((80 / 150) * 100, 5)
    const courierKill = result.find((r) => r.scenario === 'courier_kill')
    expect(courierKill?.winRate).toBeCloseTo(70, 5)
  })

  test('returns an empty array for empty input', () => {
    expect(aggregateScenarioWinRates([])).toEqual([])
  })
})
