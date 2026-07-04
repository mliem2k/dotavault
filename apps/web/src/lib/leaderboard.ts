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

// Same-origin proxy (Cloudflare Pages Function in prod, Vite proxy in dev) —
// Valve's leaderboard webapi has no CORS headers of its own.
export async function fetchLeaderboard(division: Division): Promise<LeaderboardResponse> {
  const res = await fetch(`/api/leaderboard?division=${division}`)
  if (!res.ok) throw new Error(`leaderboard ${res.status}`)
  return res.json()
}

export function countryFlagUrl(country: string): string {
  return `https://community.akamai.steamstatic.com/public/images/countryflags/${country}.gif`
}
