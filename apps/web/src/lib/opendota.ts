import type {
  AbilityConst,
  HeroBenchmarks,
  HeroStat,
  ItemConst,
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

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' })
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
  heroBenchmarks: (heroId: number) => get<HeroBenchmarks>(`/benchmarks?hero_id=${heroId}`),
  heroDurations: (id: string) => get<unknown[]>(`/heroes/${id}/durations`),
  heroItemTimings: (id: string) => get<unknown[]>(`/heroes/${id}/itemTimings`),
  proMatches: () => get<ProMatch[]>('/proMatches'),
  proPlayers: () => get<ProPlayer[]>('/proPlayers'),
  search: (q: string) => get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
  items: () => get<Record<string, ItemConst>>('/constants/items'),
  abilities: () => get<Record<string, AbilityConst>>('/constants/abilities'),
  abilityIds: () => get<Record<string, string>>('/constants/ability_ids'),
  heroAbilities: () =>
    get<Record<string, { abilities: string[]; talents: { name: string; level: number }[] }>>(
      '/constants/hero_abilities',
    ),
  heroLore: () => get<Record<string, string>>('/constants/hero_lore'),
  playerTotals: (id: string) => get<{ field: string; n: number; sum: number }[]>(`/players/${id}/totals`),
  requestParse: (matchId: string) => post<{ job: { jobId: number } }>(`/request/${matchId}`),
  team: (id: number) =>
    get<{ team_id: number; name: string; tag: string; logo_url: string | null; wins: number; losses: number; rating: number }>(`/teams/${id}`),
}
