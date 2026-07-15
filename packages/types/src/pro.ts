export type ProMatch = {
  match_id: number
  duration: number
  start_time: number
  radiant_team_id: number | null
  radiant_name: string | null
  dire_team_id: number | null
  dire_name: string | null
  leagueid: number
  league_name: string | null
  series_id: number
  series_type: number
  radiant_score: number | null
  dire_score: number | null
  radiant_win: boolean | null
}

export type ProPlayer = {
  account_id: number
  steamid: string
  avatar: string
  avatarmedium: string
  avatarfull: string
  profileurl: string
  personaname: string | null
  last_login: string | null
  loccountrycode: string | null
  last_match_time: string | null
  name: string | null
  country_code: string | null
  fantasy_role: number | null
  team_id: number | null
  team_name: string | null
  team_tag: string | null
  is_locked: boolean
  is_pro: boolean
  locked_until: number | null
}

export type LiveMatch = {
  match_id: string
  average_mmr: number
  game_time: number
  delay: number
  spectators: number
  radiant_score: number
  dire_score: number
  team_name_radiant: string
  team_name_dire: string
  league_id: number
}
