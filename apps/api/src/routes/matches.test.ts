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

const DAY = 24 * 60 * 60
// Match 9 finished long enough ago that Valve's CDN has certainly dropped
// its replay; every other match in these tests is recent.
const startTimeFor = (path: string) =>
  path === '/matches/9'
    ? Math.floor(Date.now() / 1000) - 60 * DAY
    : Math.floor(Date.now() / 1000) - DAY

mock.module('../lib/opendota', () => ({
  fetchCached: async (path: string) => ({
    match_id: 1,
    start_time: startTimeFor(path),
    duration: 1800,
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
  // Mirrors the real rule (see parse_orchestrator). The fixtures sit 1 day
  // and 60 days old, far either side of any plausible retention window, so
  // this stays correct even if the real constant is retuned.
  replayExpired: (startTime?: number, duration?: number) =>
    !!startTime && Date.now() / 1000 - (startTime + (duration ?? 0)) > 21 * DAY,
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

  // Without these the client has no terminal signal, so it polls every 15s
  // forever, and each poll past the server's job retention kicks off another
  // full parse orchestration for a replay that no longer exists.
  it('reports a match too old for Valve to still host as unavailable, without starting a parse job', async () => {
    startParseJobCalls.length = 0
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/9'))
    const body = await res.json()
    expect(body.replay_status).toBe('unavailable')
    expect(startParseJobCalls).toEqual([])
  })

  it('reports a replay Valve has already 404ed as unavailable and does not restart the job', async () => {
    startParseJobCalls.length = 0
    jobStatuses.set(6, { phase: 'gone', updatedAt: Date.now() })
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/6'))
    const body = await res.json()
    expect(body.replay_status).toBe('unavailable')
    expect(startParseJobCalls).toEqual([])
  })

  it('reports a failed parse as unavailable so the client stops polling', async () => {
    startParseJobCalls.length = 0
    jobStatuses.set(8, { phase: 'failed', updatedAt: Date.now() })
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/8'))
    const body = await res.json()
    expect(body.replay_status).toBe('unavailable')
    expect(startParseJobCalls).toEqual([])
  })

  it('reports an in-flight parse as parsing so the client keeps polling', async () => {
    jobStatuses.set(7, { phase: 'parsing', updatedAt: Date.now() })
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/7'))
    const body = await res.json()
    expect(body.replay_status).toBe('parsing')
  })

  it('omits replay_status once the parse has landed', async () => {
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/1'))
    const body = await res.json()
    expect(body.replay_status).toBeUndefined()
  })

  it('returns 400 for a non-numeric match id without starting a parse job', async () => {
    startParseJobCalls.length = 0
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/abc'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'invalid match id' })
    expect(startParseJobCalls).toEqual([])
  })

  it('returns 400 for a non-positive match id without starting a parse job', async () => {
    startParseJobCalls.length = 0
    const res = await matchesPlugin.handle(new Request('http://localhost/matches/-5'))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'invalid match id' })
    expect(startParseJobCalls).toEqual([])
  })
})
