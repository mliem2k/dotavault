import { describe, expect, it } from 'bun:test'
import type { PickBan } from 'types'
import {
  emptyPairTally,
  finalizePairTally,
  foldMatchIntoPairTally,
  pairKey,
} from './pro_draft_pairs'

function pb(overrides: Partial<PickBan>): PickBan {
  return { is_pick: true, hero_id: 1, team: 0, order: 0, ...overrides }
}

// A full 5v5 draft: radiant heroes 1-5, dire heroes 6-10.
function fullDraft(): PickBan[] {
  const picks: PickBan[] = []
  for (let i = 1; i <= 5; i++) picks.push(pb({ hero_id: i, team: 0, order: picks.length }))
  for (let i = 6; i <= 10; i++) picks.push(pb({ hero_id: i, team: 1, order: picks.length }))
  return picks
}

// The mirror of fullDraft: dire heroes 1-5, radiant heroes 6-10. Every
// opposing pair here has its lower hero id on the Dire side, which is the
// only way to exercise the "lower id is Dire" branch of the versus
// perspective flip.
function reverseDraft(): PickBan[] {
  const picks: PickBan[] = []
  for (let i = 1; i <= 5; i++) picks.push(pb({ hero_id: i, team: 1, order: picks.length }))
  for (let i = 6; i <= 10; i++) picks.push(pb({ hero_id: i, team: 0, order: picks.length }))
  return picks
}

describe('pairKey', () => {
  it('normalizes both orderings to the same key', () => {
    expect(pairKey(7, 3)).toBe(pairKey(3, 7))
    expect(pairKey(3, 7)).toBe('3-7')
  })
})

describe('foldMatchIntoPairTally', () => {
  it('records 20 same-team pairs and 25 opposing pairs for a full draft', () => {
    const tally = emptyPairTally()
    foldMatchIntoPairTally(tally, { radiant_win: true, picks_bans: fullDraft() })

    const rows = finalizePairTally(tally)
    const together = rows.filter((r) => r.together.sample > 0)
    const versus = rows.filter((r) => r.versus.sample > 0)
    // 2 teams * C(5,2) = 20 same-team pairs, 5 * 5 = 25 opposing pairs.
    expect(together.length).toBe(20)
    expect(versus.length).toBe(25)
    expect(tally.totalMatches).toBe(1)
  })

  it('credits same-team pairs to the team that actually won', () => {
    const tally = emptyPairTally()
    foldMatchIntoPairTally(tally, { radiant_win: true, picks_bans: fullDraft() })
    const rows = finalizePairTally(tally)

    // Heroes 1 and 2 were both Radiant, and Radiant won.
    const radiantPair = rows.find((r) => r.heroA === 1 && r.heroB === 2)
    expect(radiantPair?.together).toEqual({ wins: 1, sample: 1 })

    // Heroes 6 and 7 were both Dire, and Dire lost.
    const direPair = rows.find((r) => r.heroA === 6 && r.heroB === 7)
    expect(direPair?.together).toEqual({ wins: 0, sample: 1 })
  })

  it('records versus wins from the lower hero id perspective', () => {
    const tally = emptyPairTally()
    // Hero 3 (Radiant, lower id) beats hero 8 (Dire, higher id).
    foldMatchIntoPairTally(tally, { radiant_win: true, picks_bans: fullDraft() })
    // Hero 4 (Radiant, lower id) loses to hero 9 (Dire, higher id).
    foldMatchIntoPairTally(tally, { radiant_win: false, picks_bans: fullDraft() })
    const rows = finalizePairTally(tally)

    const matchup = rows.find((r) => r.heroA === 3 && r.heroB === 8)
    // Two matches: the lower id (3, always Radiant here) won exactly one.
    expect(matchup?.versus).toEqual({ wins: 1, sample: 2 })
  })

  it('records versus wins from the lower hero id perspective when the lower id is Dire', () => {
    const tally = emptyPairTally()
    // Sides are swapped from fullDraft: hero 1 (lower id) is Dire here, and
    // Dire wins this match (radiant_win: false), so the lower id should be
    // credited with the win, not the loss.
    foldMatchIntoPairTally(tally, { radiant_win: false, picks_bans: reverseDraft() })
    const rows = finalizePairTally(tally)

    const matchup = rows.find((r) => r.heroA === 1 && r.heroB === 6)
    // A single decisive match: the lower id (1, Dire here) won it.
    expect(matchup?.versus).toEqual({ wins: 1, sample: 1 })
  })

  it('counts a match with no picks_bans toward totalMatches but records no pairs', () => {
    const tally = emptyPairTally()
    foldMatchIntoPairTally(tally, { radiant_win: true, picks_bans: null })

    expect(tally.totalMatches).toBe(1)
    expect(finalizePairTally(tally)).toEqual([])
  })

  it('ignores bans, which have no teammates or opponents', () => {
    const tally = emptyPairTally()
    foldMatchIntoPairTally(tally, {
      radiant_win: true,
      picks_bans: [
        pb({ is_pick: false, hero_id: 20, team: 0, order: 0 }),
        pb({ is_pick: false, hero_id: 21, team: 1, order: 1 }),
      ],
    })

    expect(finalizePairTally(tally)).toEqual([])
  })
})
