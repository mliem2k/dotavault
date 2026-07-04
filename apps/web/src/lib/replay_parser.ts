// Client for the dotavault replay-parser Go service (apps/replay-parser),
// which downloads a match replay directly from Valve's CDN and extracts
// continuous hero positions with manta. Separate from OpenDota's own parse
// (which only ever produces sparse teamfight/ward snapshots) and only works
// while Valve is still actually serving the replay file.

const BASE_URL = import.meta.env.VITE_REPLAY_PARSER_URL ?? 'http://localhost:8081'

export type PositionPoint = { t: number; x: number; y: number }
export type ReplayPositions = {
  match_id: number
  duration: number
  positions: Record<string, PositionPoint[]>
}

export class ReplayUnavailableError extends Error {}

export async function parseReplayPositions(
  matchId: number,
  cluster: number,
  replaySalt: number,
): Promise<ReplayPositions> {
  const res = await fetch(`${BASE_URL}/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ match_id: matchId, cluster, replay_salt: replaySalt }),
  })
  if (res.status === 404) {
    throw new ReplayUnavailableError("Replay is no longer available on Valve's CDN")
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `replay-parser ${res.status}`)
  }
  return res.json()
}
