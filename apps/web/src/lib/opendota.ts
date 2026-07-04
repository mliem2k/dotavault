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

export type ProMatchRow = {
  match_id: number
  start_time: number
  duration: number
  league_name: string | null
  hero_id: number
  kills: number
  deaths: number
  assists: number
  player_slot: number
  radiant_win: boolean
  gold_per_min: number | null
  xp_per_min: number | null
  last_hits: number | null
}

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
  playerMatches: (
    id: string,
    opts?: {
      limit?: number
      offset?: number
      heroId?: number
      win?: 0 | 1
      gameMode?: number
      lobbyType?: number
      laneRole?: number
      isRadiant?: 0 | 1
      date?: number
      withHeroId?: number
      againstHeroId?: number
      includedAccountId?: number
      project?: string[]
    },
  ) => {
    const params = new URLSearchParams()
    params.set('limit', String(opts?.limit ?? 50))
    if (opts?.offset) params.set('offset', String(opts.offset))
    if (opts?.heroId != null) params.set('hero_id', String(opts.heroId))
    if (opts?.win != null) params.set('win', String(opts.win))
    if (opts?.gameMode != null) params.set('game_mode', String(opts.gameMode))
    if (opts?.lobbyType != null) params.set('lobby_type', String(opts.lobbyType))
    if (opts?.laneRole != null) params.set('lane_role', String(opts.laneRole))
    if (opts?.isRadiant != null) params.set('is_radiant', String(opts.isRadiant))
    if (opts?.date != null) params.set('date', String(opts.date))
    if (opts?.withHeroId != null) params.set('with_hero_id', String(opts.withHeroId))
    if (opts?.againstHeroId != null) params.set('against_hero_id', String(opts.againstHeroId))
    if (opts?.includedAccountId != null) params.set('included_account_id', String(opts.includedAccountId))
    for (const p of opts?.project ?? []) params.append('project', p)
    return get<PlayerMatch[]>(`/players/${id}/matches?${params.toString()}`)
  },
  // Official league/tournament matches only. OpenDota's plain matches
  // endpoint has no leagueid filter (and can't even project it out), so this
  // goes through the SQL Explorer instead, joining in the league name for
  // display. account_id is guaranteed numeric by the caller (route-level
  // guard); heroId/win/date are always our own numeric dropdown values, never
  // free text, so string interpolation here can't be injected.
  playerProMatches: (
    id: string,
    opts?: { limit?: number; offset?: number; heroId?: number; win?: 0 | 1; date?: number },
  ) => {
    if (!/^\d+$/.test(id)) throw new Error('invalid account id')
    const limit = Math.min(200, Math.max(1, Math.trunc(opts?.limit ?? 30)))
    const offset = Math.max(0, Math.trunc(opts?.offset ?? 0))
    const conditions = [`player_matches.account_id = ${id}`, 'matches.leagueid > 0']
    if (opts?.heroId != null && Number.isFinite(opts.heroId)) {
      conditions.push(`player_matches.hero_id = ${Math.trunc(opts.heroId)}`)
    }
    if (opts?.win === 0 || opts?.win === 1) {
      conditions.push(`((player_matches.player_slot < 128) = matches.radiant_win) = ${opts.win === 1}`)
    }
    if (opts?.date != null && Number.isFinite(opts.date)) {
      conditions.push(`matches.start_time > extract(epoch from now() - interval '${Math.trunc(opts.date)} days')`)
    }
    const sql = `SELECT matches.match_id, matches.start_time, matches.duration, leagues.name as league_name, player_matches.hero_id, player_matches.kills, player_matches.deaths, player_matches.assists, player_matches.player_slot, matches.radiant_win, player_matches.gold_per_min, player_matches.xp_per_min, player_matches.last_hits FROM player_matches JOIN matches USING(match_id) LEFT JOIN leagues USING(leagueid) WHERE ${conditions.join(' AND ')} ORDER BY matches.start_time DESC LIMIT ${limit} OFFSET ${offset}`
    return get<{ rows: ProMatchRow[] }>(`/explorer?sql=${encodeURIComponent(sql)}`).then((r) => r.rows)
  },
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
  chatWheel: () =>
    get<Record<string, { id: number; name?: string; message?: string; label?: string }>>(
      '/constants/chat_wheel',
    ),
  heroAbilities: () =>
    get<Record<string, { abilities: string[]; talents: { name: string; level: number }[] }>>(
      '/constants/hero_abilities',
    ),
  heroLore: () => get<Record<string, string>>('/constants/hero_lore'),
  aghsDesc: () => get<import('types').AghsDesc[]>('/constants/aghs_desc'),
  playerTotals: (id: string) => get<{ field: string; n: number; sum: number }[]>(`/players/${id}/totals`),
  playerPeers: (id: string) =>
    get<
      {
        account_id: number
        personaname: string | null
        avatarfull: string | null
        last_played: number
        with_games: number
        with_win: number
        against_games: number
        against_win: number
      }[]
    >(`/players/${id}/peers`),
  playerCounts: (id: string) =>
    get<Record<string, Record<string, { games: number; win: number }>>>(`/players/${id}/counts`),
  requestParse: (matchId: string) => post<{ job: { jobId: number } }>(`/request/${matchId}`),
  team: (id: number) =>
    get<{ team_id: number; name: string; tag: string; logo_url: string | null; wins: number; losses: number; rating: number }>(`/teams/${id}`),
}
