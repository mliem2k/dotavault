import { describe, expect, test } from 'bun:test'
import { inferBracket, isAdjacentRound, isWinningContinuation } from './infer_bracket'
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

  test('keeps both semifinals in the same round even when one team has extra earlier matches (group-stage noise)', () => {
    // Team 1 plays three unrelated early "group stage" matches before the
    // real bracket starts, team 2/3/4 don't. A forward, oldest-first round
    // count would inflate team 1's round number from this noise alone,
    // pushing semi1 (1v2) several columns later than semi2 (3v4) even
    // though they're really the same round of the same bracket. Counting
    // backward from the final instead means only genuine bracket depth
    // (distance from the final) matters, so pre-bracket noise for one team
    // doesn't distort where its real bracket matches land.
    const padding1 = makeSeries('padding1', 1, 5, 10)
    const padding2 = makeSeries('padding2', 1, 6, 20)
    const padding3 = makeSeries('padding3', 1, 7, 30)
    const semi1 = makeSeries('semi1', 1, 2, 100)
    const semi2 = makeSeries('semi2', 3, 4, 100)
    const final = makeSeries('final', 1, 3, 200)
    const { rounds } = inferBracket([padding1, padding2, padding3, semi1, semi2, final])
    const roundOfKey = (key: string) => rounds.findIndex((round) => round.some((s) => s.key === key))
    expect(roundOfKey('semi1')).toBe(roundOfKey('semi2'))
    expect(roundOfKey('final')).toBe(roundOfKey('semi1') + 1)
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

describe('isAdjacentRound', () => {
  test('is true when the child is exactly one round after the parent', () => {
    expect(isAdjacentRound(2, 3)).toBe(true)
  })

  test('is false when the child is two rounds after the parent (a round-inference gap)', () => {
    expect(isAdjacentRound(2, 4)).toBe(false)
  })

  test('is false when the child is three rounds after the parent', () => {
    expect(isAdjacentRound(3, 6)).toBe(false)
  })

  test('is false when the parent round is unknown (undefined)', () => {
    expect(isAdjacentRound(undefined, 3)).toBe(false)
  })

  test('is false when the child is somehow not after the parent at all', () => {
    expect(isAdjacentRound(3, 3)).toBe(false)
  })
})
