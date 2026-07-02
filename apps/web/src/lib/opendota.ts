import type {
  HeroStat,
  Match,
  PlayerHero,
  PlayerMatch,
  PlayerWL,
  ProMatch,
  ProPlayer,
  SearchResult,
} from 'types'
import type { Player } from 'types'

const BASE = 'https://api.opendota.com/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`OpenDota ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const opendota = {
  player: (id: string) => get<Player>(`/players/${id}`),
  playerWL: (id: string) => get<PlayerWL>(`/players/${id}/wl`),
  playerMatches: (id: string, limit = 50) =>
    get<PlayerMatch[]>(`/players/${id}/matches?limit=${limit}`),
  playerHeroes: (id: string) => get<PlayerHero[]>(`/players/${id}/heroes`),
  match: (id: string) => get<Match>(`/matches/${id}`),
  heroStats: () => get<HeroStat[]>('/heroStats'),
  heroDurations: (id: string) => get<unknown[]>(`/heroes/${id}/durations`),
  heroItemTimings: (id: string) => get<unknown[]>(`/heroes/${id}/itemTimings`),
  proMatches: () => get<ProMatch[]>('/proMatches'),
  proPlayers: () => get<ProPlayer[]>('/proPlayers'),
  search: (q: string) => get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
}
