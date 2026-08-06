import { describe, expect, test } from 'bun:test'
import type { Match } from 'types'
import { shouldPollForParse } from './api_match'

// Only the fields the poll decision reads; the rest of Match is irrelevant here.
const match = (fields: Partial<Match>): Match => fields as Match

describe('shouldPollForParse', () => {
  test('polls while our own parse is still running', () => {
    expect(shouldPollForParse(match({ replay_status: 'parsing' }))).toBe(true)
  })

  test('stops once our own parse has landed', () => {
    expect(shouldPollForParse(match({ kills: [] }))).toBe(false)
  })

  // The loop this whole change exists to stop: an old match whose replay
  // Valve no longer hosts never gains `kills`, so a kills-only check polls
  // every 15s for as long as the tab stays open, and each poll can restart a
  // server-side parse job that is guaranteed to 404.
  test('stops when the replay can never be fetched', () => {
    expect(shouldPollForParse(match({ replay_status: 'unavailable' }))).toBe(false)
  })

  test('does not poll before any data has arrived', () => {
    expect(shouldPollForParse(undefined)).toBe(false)
  })
})
