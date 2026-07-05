export type Division = 'americas' | 'europe' | 'se_asia' | 'china'

export const DIVISIONS: { id: Division; label: string }[] = [
  { id: 'americas', label: 'Americas' },
  { id: 'europe', label: 'Europe' },
  { id: 'se_asia', label: 'SE Asia' },
  { id: 'china', label: 'China' },
]

export type LeaderboardEntry = {
  rank: number
  name: string
  team_id?: number
  team_tag?: string
  sponsor?: string
  country?: string
}

export type LeaderboardResponse = {
  time_posted: number
  next_scheduled_post_time: number
  server_time: number
  leaderboard: LeaderboardEntry[]
}

// Same-origin proxy (Cloudflare Pages Function in prod, Vite proxy in dev),
// Valve's leaderboard webapi has no CORS headers of its own.
export async function fetchLeaderboard(division: Division): Promise<LeaderboardResponse> {
  const res = await fetch(`/api/leaderboard?division=${division}`)
  if (!res.ok) throw new Error(`leaderboard ${res.status}`)
  return res.json()
}

export function countryFlagUrl(country: string): string {
  return `https://community.akamai.steamstatic.com/public/images/countryflags/${country}.gif`
}

export type LeaderboardPosition = { division: Division; rank: number }

// All four divisions fetched once, indexed by lowercased name for O(1)
// lookups. Used both for a single player's rank and for sorting a whole
// list of pros without refetching per player.
async function fetchAllLeaderboards(): Promise<Map<string, LeaderboardPosition>> {
  const results = await Promise.allSettled(DIVISIONS.map((d) => fetchLeaderboard(d.id)))
  const byName = new Map<string, LeaderboardPosition>()
  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return
    for (const entry of res.value.leaderboard) {
      const key = entry.name.toLowerCase()
      const existing = byName.get(key)
      if (!existing || entry.rank < existing.rank) byName.set(key, { division: DIVISIONS[i].id, rank: entry.rank })
    }
  })
  return byName
}

// Live top-5000 rank for a player, by exact case-insensitive name match
// against all four divisions (same trust rule as the leaderboards page:
// no fuzzy matching, a wrong match here would misidentify a real account).
// OpenDota's own player.leaderboard_rank field is a stale cached copy of
// this same data (confirmed against a real account: OpenDota said rank 2,
// Valve's live leaderboard actually had them at rank 1), so this is worth
// checking directly rather than trusting that field.
export async function findLeaderboardPosition(names: string[]): Promise<LeaderboardPosition | null> {
  const candidates = names.map((n) => n.toLowerCase()).filter(Boolean)
  if (candidates.length === 0) return null
  const byName = await fetchAllLeaderboards()
  let best: LeaderboardPosition | null = null
  for (const c of candidates) {
    const pos = byName.get(c)
    if (pos && (!best || pos.rank < best.rank)) best = pos
  }
  return best
}

// Bulk version for ranking a whole list of players against the live
// leaderboard in one fetch (four requests total, not four per player).
export async function findLeaderboardPositions(
  players: { key: string; names: string[] }[],
): Promise<Map<string, LeaderboardPosition>> {
  const byName = await fetchAllLeaderboards()
  const result = new Map<string, LeaderboardPosition>()
  for (const p of players) {
    let best: LeaderboardPosition | null = null
    for (const n of p.names) {
      const pos = byName.get(n.toLowerCase())
      if (pos && (!best || pos.rank < best.rank)) best = pos
    }
    if (best) result.set(p.key, best)
  }
  return result
}
