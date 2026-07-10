import type {
  AbilityConst,
  HeroBenchmarks,
  HeroStat,
  ItemConst,
  Match,
  Player,
  PlayerHero,
  PlayerMatch,
  PlayerWL,
  ProMatch,
  ProPlayer,
  SearchResult,
} from 'types'

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

// OpenDota's public API rate-limits fairly aggressively under bursts (pages
// that fan out many per-item requests, e.g. per-team name lookups on a
// league standings page, routinely see a chunk of them come back 429).
// Since call sites like use_team_map.ts swallow individual failures with
// their own try/catch (so a permanently-fallback-labeled team never
// recovers even after the burst passes), retry a 429 here at the fetch
// layer instead, honoring Retry-After when present.
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429 || attempt === maxAttempts - 1) return res
    const retryAfterSec = Number(res.headers.get('retry-after'))
    const delayMs =
      Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : 500 * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return fetch(url, init)
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`)
  if (!res.ok) throw new Error(`OpenDota ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${BASE}${path}`, { method: 'POST' })
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
    if (opts?.includedAccountId != null)
      params.set('included_account_id', String(opts.includedAccountId))
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
      conditions.push(
        `((player_matches.player_slot < 128) = matches.radiant_win) = ${opts.win === 1}`,
      )
    }
    if (opts?.date != null && Number.isFinite(opts.date)) {
      conditions.push(
        `matches.start_time > extract(epoch from now() - interval '${Math.trunc(opts.date)} days')`,
      )
    }
    const sql = `SELECT matches.match_id, matches.start_time, matches.duration, leagues.name as league_name, player_matches.hero_id, player_matches.kills, player_matches.deaths, player_matches.assists, player_matches.player_slot, matches.radiant_win, player_matches.gold_per_min, player_matches.xp_per_min, player_matches.last_hits FROM player_matches JOIN matches USING(match_id) LEFT JOIN leagues USING(leagueid) WHERE ${conditions.join(' AND ')} ORDER BY matches.start_time DESC LIMIT ${limit} OFFSET ${offset}`
    return get<{ rows: ProMatchRow[] }>(`/explorer?sql=${encodeURIComponent(sql)}`).then(
      (r) => r.rows,
    )
  },
  playerHeroes: (id: string) => get<PlayerHero[]>(`/players/${id}/heroes`),
  match: (id: string) => get<Match>(`/matches/${id}`),
  heroStats: () => get<HeroStat[]>('/heroStats'),
  heroBenchmarks: (heroId: number) => get<HeroBenchmarks>(`/benchmarks?hero_id=${heroId}`),
  // Win rate by game-length bucket (duration_bin is in seconds).
  heroDurations: (id: string) =>
    get<{ duration_bin: number; games_played: number; wins: number }[]>(`/heroes/${id}/durations`),
  // Win rate against every other hero, from this hero's own matches.
  heroMatchups: (id: string) =>
    get<{ hero_id: number; games_played: number; wins: number }[]>(`/heroes/${id}/matchups`),
  // Most-purchased items per game phase (counts, not win rates; OpenDota
  // doesn't expose a per-item win rate for this breakdown).
  heroItemPopularity: (id: string) =>
    get<{
      start_game_items: Record<string, number>
      early_game_items: Record<string, number>
      mid_game_items: Record<string, number>
      late_game_items: Record<string, number>
    }>(`/heroes/${id}/itemPopularity`),
  // Win rate by lane role (1 safe, 2 mid, 3 off), last 60 days. heroId is
  // always our own numeric hero.id, never free text, so string
  // interpolation here can't be injected (same pattern as the league
  // report's leagueid-scoped queries).
  heroLaneRoles: (heroId: number) => {
    const sql = `SELECT lane_role, count(*)::int as picks, sum(CASE WHEN (pm.player_slot < 128) = m.radiant_win THEN 1 ELSE 0 END)::int as wins FROM player_matches pm JOIN matches m ON pm.match_id = m.match_id WHERE pm.hero_id = ${heroId} AND lane_role IS NOT NULL AND m.start_time > extract(epoch from now() - interval '60 days') GROUP BY lane_role`
    return get<{ rows: { lane_role: number; picks: number; wins: number }[] }>(
      `/explorer?sql=${encodeURIComponent(sql)}`,
    ).then((r) => r.rows)
  },
  proMatches: (lessThan?: number) =>
    get<ProMatch[]>(`/proMatches${lessThan ? `?less_than_match_id=${lessThan}` : ''}`),
  teamsList: () =>
    get<
      {
        team_id: number
        rating: number
        wins: number
        losses: number
        last_match_time: number
        name: string | null
        tag: string | null
        logo_url: string | null
      }[]
    >('/teams'),
  proPlayers: () => get<ProPlayer[]>('/proPlayers'),
  // Full league directory (~10k rows), used for the /leagues browser and to
  // resolve a league's own name/tier before its match data loads.
  leaguesList: () => get<{ leagueid: number; name: string; tier: string | null }[]>('/leagues'),
  // League report queries, all scoped by `WHERE leagueid = ${id}`. id is
  // always the numeric route param (validated by the caller), never free
  // text, so string interpolation here can't be injected.
  leagueSummary: (id: number) => {
    const sql = `SELECT count(*)::int as total_matches, min(start_time) as first_match, max(start_time) as last_match FROM matches WHERE leagueid = ${id}`
    return get<{
      rows: { total_matches: number; first_match: number | null; last_match: number | null }[]
    }>(`/explorer?sql=${encodeURIComponent(sql)}`).then((r) => r.rows[0])
  },
  leagueHeroStats: (id: number) => {
    const sql = `SELECT pm.hero_id, count(*)::int as picks, sum(CASE WHEN (pm.player_slot < 128) = m.radiant_win THEN 1 ELSE 0 END)::int as wins FROM player_matches pm JOIN matches m ON pm.match_id = m.match_id WHERE m.leagueid = ${id} GROUP BY pm.hero_id ORDER BY picks DESC`
    return get<{ rows: { hero_id: number; picks: number; wins: number }[] }>(
      `/explorer?sql=${encodeURIComponent(sql)}`,
    ).then((r) => r.rows)
  },
  leagueBanStats: (id: number) => {
    const sql = `SELECT (pb->>'hero_id')::int as hero_id, count(*)::int as bans FROM matches, unnest(picks_bans) pb WHERE leagueid = ${id} AND (pb->>'is_pick')::boolean = false GROUP BY hero_id ORDER BY bans DESC`
    return get<{ rows: { hero_id: number; bans: number }[] }>(
      `/explorer?sql=${encodeURIComponent(sql)}`,
    ).then((r) => r.rows)
  },
  leagueTeamStandings: (id: number) => {
    const sql = `SELECT team_id, sum(wins)::int as wins, sum(losses)::int as losses FROM (SELECT radiant_team_id as team_id, CASE WHEN radiant_win THEN 1 ELSE 0 END as wins, CASE WHEN NOT radiant_win THEN 1 ELSE 0 END as losses FROM matches WHERE leagueid = ${id} AND radiant_team_id IS NOT NULL UNION ALL SELECT dire_team_id as team_id, CASE WHEN NOT radiant_win THEN 1 ELSE 0 END as wins, CASE WHEN radiant_win THEN 1 ELSE 0 END as losses FROM matches WHERE leagueid = ${id} AND dire_team_id IS NOT NULL) t GROUP BY team_id ORDER BY wins DESC`
    return get<{ rows: { team_id: number; wins: number; losses: number }[] }>(
      `/explorer?sql=${encodeURIComponent(sql)}`,
    ).then((r) => r.rows)
  },
  leagueMatches: (id: number, limit = 50, offset = 0) => {
    const lim = Math.min(500, Math.max(1, Math.trunc(limit)))
    const off = Math.max(0, Math.trunc(offset))
    const sql = `SELECT match_id, start_time, duration, radiant_team_id, dire_team_id, radiant_win, radiant_score, dire_score, series_id, series_type FROM matches WHERE leagueid = ${id} ORDER BY start_time ASC LIMIT ${lim} OFFSET ${off}`
    return get<{
      rows: {
        match_id: number
        start_time: number
        duration: number
        radiant_team_id: number | null
        dire_team_id: number | null
        radiant_win: boolean
        radiant_score: number | null
        dire_score: number | null
        series_id: number | null
        series_type: number | null
      }[]
    }>(`/explorer?sql=${encodeURIComponent(sql)}`).then((r) => r.rows)
  },
  // Which players actually competed for which team in a given league (not
  // just a team's current roster, which drifts as rosters change): derived
  // straight from player_matches so it reflects who played, at the time
  // they played it.
  leagueRoster: (id: number) => {
    const sql = `SELECT pm.account_id, CASE WHEN pm.player_slot < 128 THEN m.radiant_team_id ELSE m.dire_team_id END as team_id, count(*)::int as games, sum(CASE WHEN (pm.player_slot < 128) = m.radiant_win THEN 1 ELSE 0 END)::int as wins FROM player_matches pm JOIN matches m ON pm.match_id = m.match_id WHERE m.leagueid = ${id} AND pm.account_id IS NOT NULL GROUP BY pm.account_id, team_id ORDER BY team_id, games DESC`
    return get<{
      rows: { account_id: number; team_id: number | null; games: number; wins: number }[]
    }>(`/explorer?sql=${encodeURIComponent(sql)}`).then((r) => r.rows)
  },
  // Signal for refining a team roster's role display beyond OpenDota's own
  // fantasy_role (which only distinguishes Carry/Support/Offlane/Mid, not
  // soft vs hard support, and is sometimes just unset for a player):
  // per-account average GPM (lower GPM among a team's two "Support"-tagged
  // players reliably identifies the hard support, verified against a real
  // known case) and lane_role distribution (a player whose games are
  // overwhelmingly lane_role=2 is unambiguously a mid laner even with no
  // fantasy_role set). accountIds always come from an already-fetched
  // roster (never user input), coerced to integers before interpolation.
  teamRoleSignal: (accountIds: number[]) => {
    const ids = accountIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id))
    if (ids.length === 0) {
      return Promise.resolve({
        gpm: [] as { account_id: number; avg_gpm: number }[],
        lane: [] as { account_id: number; lane_role: number; games: number }[],
      })
    }
    const gpmSql = `SELECT account_id, avg(gold_per_min)::int as avg_gpm FROM player_matches WHERE account_id IN (${ids.join(',')}) AND gold_per_min IS NOT NULL GROUP BY account_id`
    const laneSql = `SELECT account_id, lane_role, count(*)::int as games FROM player_matches WHERE account_id IN (${ids.join(',')}) AND lane_role IS NOT NULL GROUP BY account_id, lane_role`
    return Promise.all([
      get<{ rows: { account_id: number; avg_gpm: number }[] }>(
        `/explorer?sql=${encodeURIComponent(gpmSql)}`,
      ),
      get<{ rows: { account_id: number; lane_role: number; games: number }[] }>(
        `/explorer?sql=${encodeURIComponent(laneSql)}`,
      ),
    ]).then(([gpm, lane]) => ({ gpm: gpm.rows, lane: lane.rows }))
  },
  // Which of a batch of matches were tournament matches, and which league.
  // The plain /players/:id/matches REST endpoint has no leagueid field at
  // all (confirmed: requesting it via project= just comes back null even
  // for real tournament matches), so this goes through the SQL Explorer, a
  // lookup by match_id (primary key) instead of any join, so it stays
  // cheap even for a full page of matches. matchIds always come from an
  // already-fetched match list (never user input), and are coerced to
  // integers before interpolation, so this can't be injected.
  matchesLeagueInfo: (matchIds: number[]) => {
    const ids = matchIds.map((id) => Math.trunc(id)).filter((id) => Number.isFinite(id))
    if (ids.length === 0)
      return Promise.resolve(
        [] as { match_id: number; leagueid: number; league_name: string | null }[],
      )
    const sql = `SELECT matches.match_id, matches.leagueid, leagues.name as league_name FROM matches LEFT JOIN leagues USING(leagueid) WHERE matches.match_id IN (${ids.join(',')}) AND matches.leagueid > 0`
    return get<{ rows: { match_id: number; leagueid: number; league_name: string | null }[] }>(
      `/explorer?sql=${encodeURIComponent(sql)}`,
    ).then((r) => r.rows)
  },
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
  playerTotals: (id: string) =>
    get<{ field: string; n: number; sum: number }[]>(`/players/${id}/totals`),
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
    get<{
      team_id: number
      name: string
      tag: string
      logo_url: string | null
      wins: number
      losses: number
      rating: number
    }>(`/teams/${id}`),
}
