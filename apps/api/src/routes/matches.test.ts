import { describe, expect, it, mock } from 'bun:test'

// No plain-function equivalent exists to inject here (unlike pro_meta_tick's
// fetchFn param, e.g.) — matchesPlugin imports these dependencies directly
// at module scope, so isolating it from the real OpenDota network and the
// real parse-job orchestrator requires bun:test's mock.module. mock.module
// mutates Bun's module registry, so it must run before matches.ts is first
// imported, hence the dynamic import below.
const startParseJobCalls: Array<{
  matchId: number
  hint: { cluster: number; salt: number } | undefined
}> = []
const jobStatuses = new Map<number, { phase: string; updatedAt: number }>()

mock.module('../lib/opendota', () => ({
  fetchCached: async () => ({
    match_id: 1,
    players: [
      { match_id: 1, player_slot: 0 },
      { match_id: 1, player_slot: 128 },
    ],
  }),
  fetchReplayInfo: async (matchId: number) =>
    matchId === 4 ? { match_id: 4, cluster: 111, replay_salt: 222 } : null,
  requestOpendotaParse: async () => {},
}))

mock.module('../lib/parse_orchestrator', () => ({
  getParsedMatch: async (id: number) =>
    id === 1
      ? {
          match_id: 1,
          duration: 1800,
          players: { '0': { purchase_log: [{ key: 'item_tango', time: 5 }] } },
          kills: [],
        }
      : null,
  currentJobStatus: (matchId: number) => jobStatuses.get(matchId) ?? null,
  startParseJob: (matchId: number, hint?: { cluster: number; salt: number }) => {
    startParseJobCalls.push({ matchId, hint })
  },
}))

const { matchesPlugin } = await import('./matches')

describe('GET /matches/:id', () => {
  it('returns the merged match when a parsed row already exists', async () => {
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/1'))
    const body = await res.json()
    expect(body.players[0].purchase_log).toEqual([{ key: 'item_tango', time: 5 }])
  })

  it('returns unmerged basic fields and starts a parse job when nothing is parsed yet', async () => {
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/2'))
    const body = await res.json()
    expect(body.players[0].purchase_log).toBeUndefined()
    expect(startParseJobCalls).toContainEqual({ matchId: 2, hint: undefined })
  })

  it('passes a cluster/salt hint to startParseJob when OpenDota already knows the replay salt', async () => {
    await matchesPlugin.handle(new Request('http://localhost/matches/4'))
    expect(startParseJobCalls).toContainEqual({
      matchId: 4,
      hint: { cluster: 111, salt: 222 },
    })
  })

  it('does not start a duplicate parse job when one is already running for this match', async () => {
    startParseJobCalls.length = 0
    jobStatuses.set(5, { phase: 'parsing', updatedAt: Date.now() })
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/5'))
    expect(res.status).toBe(200)
    expect(startParseJobCalls).toEqual([])
  })
})
