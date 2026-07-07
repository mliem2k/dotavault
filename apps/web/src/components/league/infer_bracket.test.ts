import { describe, expect, test } from 'bun:test'
import { inferBracket, isWinningContinuation } from './infer_bracket'
import type { Series } from './series'

function makeSeries(
  key: string,
  teamA: number | null,
  teamB: number | null,
  lastStartTime: number,
  scoreA = 1,
  scoreB = 0,
): Series {
  return { key, teamA, teamB, scoreA, scoreB, bestOf: 1, games: [], lastStartTime }
}

describe('inferBracket', () => {
  test('groups a clean 4-team single-elimination bracket into 2 rounds', () => {
    const semi1 = makeSeries('semi1', 1, 2, 100)
    const semi2 = makeSeries('semi2', 3, 4, 100)
    const final = makeSeries('final', 1, 3, 200)
    const { rounds } = inferBracket([semi1, semi2, final])
    expect(rounds.length).toBe(2)
    expect(rounds[0].map((s) => s.key).sort()).toEqual(['semi1', 'semi2'])
    expect(rounds[1].map((s) => s.key)).toEqual(['final'])
  })

  test('links the final to both semifinal matches as parents', () => {
    const semi1 = makeSeries('semi1', 1, 2, 100)
    const semi2 = makeSeries('semi2', 3, 4, 100)
    const final = makeSeries('final', 1, 3, 200)
    const { parentOf } = inferBracket([semi1, semi2, final])
    expect(parentOf.get('final')).toEqual({ a: 'semi1', b: 'semi2' })
  })

  test('gives no parent link for a first-round match', () => {
    const semi1 = makeSeries('semi1', 1, 2, 100)
    const { parentOf } = inferBracket([semi1])
    expect(parentOf.has('semi1')).toBe(false)
  })

  test('handles a bye: a team entering later with no earlier match has no parent on that side', () => {
    const semi1 = makeSeries('semi1', 1, 2, 100)
    const final = makeSeries('final', 1, 3, 200)
    const { parentOf } = inferBracket([semi1, final])
    expect(parentOf.get('final')).toEqual({ a: 'semi1', b: undefined })
  })
})

describe('isWinningContinuation', () => {
  test('is true when the continuing team was teamA and won', () => {
    const parent = makeSeries('semi1', 1, 2, 100, 2, 0)
    expect(isWinningContinuation(1, parent)).toBe(true)
  })

  test('is true when the continuing team was teamB and won', () => {
    const parent = makeSeries('semi1', 1, 2, 100, 0, 2)
    expect(isWinningContinuation(2, parent)).toBe(true)
  })

  test('is false when the continuing team was teamA but lost (Swiss/double-elim carry-over)', () => {
    const parent = makeSeries('semi1', 1, 2, 100, 0, 2)
    expect(isWinningContinuation(1, parent)).toBe(false)
  })

  test('is false when the continuing team was teamB but lost', () => {
    const parent = makeSeries('semi1', 1, 2, 100, 2, 0)
    expect(isWinningContinuation(2, parent)).toBe(false)
  })

  test('is false when there is no parent series', () => {
    expect(isWinningContinuation(1, undefined)).toBe(false)
  })

  test('is false when the continuing team id is null', () => {
    const parent = makeSeries('semi1', 1, 2, 100, 2, 0)
    expect(isWinningContinuation(null, parent)).toBe(false)
  })
})
