export type PlayerProfile = {
  account_id: number
  personaname: string
  name: string | null
  plus: boolean
  cheese: number
  steamid: string
  avatar: string
  avatarmedium: string
  avatarfull: string
  profileurl: string
  last_login: string | null
  loccountrycode: string | null
  is_contributor: boolean
  is_subscriber: boolean
}

export type Player = {
  tracked_until: string | null
  solo_competitive_rank: number | null
  competitive_rank: number | null
  rank_tier: number | null
  leaderboard_rank: number | null
  mmr_estimate: { estimate: number } | null
  profile: PlayerProfile
}

export type PlayerWL = {
  win: number
  lose: number
}

export type PlayerMatch = {
  match_id: number
  player_slot: number
  radiant_win: boolean
  duration: number
  game_mode: number
  lobby_type: number
  hero_id: number
  start_time: number
  version: number | null
  kills: number
  deaths: number
  assists: number
  skill: number | null
  average_rank: number | null
  xp_per_min: number
  gold_per_min: number
  hero_damage: number
  tower_damage: number
  hero_healing: number
  last_hits: number
  lane: number | null
  lane_role: number | null
  is_roaming: boolean | null
  cluster: number
  leaver_status: number
  party_size: number | null
}

export type PlayerHero = {
  hero_id: string
  last_played: number
  games: number
  win: number
  with_games: number
  with_win: number
  against_games: number
  against_win: number
}

export type SearchResult = {
  account_id: number
  avatarfull: string
  personaname: string
  last_match_time: string | null
  similarity: number
}
