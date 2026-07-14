import { describe, expect, it } from 'bun:test'
import type { PatchConstant } from 'types'
import { currentPatchFromList } from './patch'

const PATCHES: PatchConstant[] = [
  { name: '7.37', date: '2024-05-22 00:00:00' },
  { name: '7.38', date: '2025-01-15 00:00:00' },
  { name: '7.39', date: '2025-11-01 00:00:00' },
]

describe('currentPatchFromList', () => {
  it('picks the newest patch whose release date is on or before now', () => {
    const now = new Date('2025-06-01 00:00:00').getTime()
    expect(currentPatchFromList(PATCHES, now)).toEqual({
      id: 1,
      name: '7.38',
      releasedAt: '2025-01-15 00:00:00',
    })
  })

  it('picks the last patch when now is after every release date', () => {
    const now = new Date('2026-01-01 00:00:00').getTime()
    expect(currentPatchFromList(PATCHES, now)).toEqual({
      id: 2,
      name: '7.39',
      releasedAt: '2025-11-01 00:00:00',
    })
  })

  it('picks the first patch when now is before every release date', () => {
    const now = new Date('2020-01-01 00:00:00').getTime()
    expect(currentPatchFromList(PATCHES, now)).toEqual({
      id: 0,
      name: '7.37',
      releasedAt: '2024-05-22 00:00:00',
    })
  })
})
