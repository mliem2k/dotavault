export type KillLog = {
  time: number
  key: string
}

export type PickBan = {
  is_pick: boolean
  hero_id: number
  team: number
  order: number
}

export type Objective = {
  time: number
  type: string
  slot: number | null
  key: string | null
  player_slot: number | null
  unit: string | null
  team: number | null
  value: number | null
}

export type TeamfightPlayer = {
  account_id: number | null
  buybacks: number
  damage: number
  deaths: number
  gold_delta: number
  healing: number
  hero_id: number
  kills: number
  x: number | null
  y: number | null
}

export type Teamfight = {
  start: number
  end: number
  last_death: number
  deaths: number
  players: TeamfightPlayer[]
}

export type MatchPlayer = {
  match_id: number
  player_slot: number
  account_id: number | null
  assists: number
  backpack_0: number
  backpack_1: number
  backpack_2: number
  deaths: number
  denies: number
  gold: number
  gold_per_min: number
  gold_spent: number
  hero_damage: number
  hero_healing: number
  hero_id: number
  item_0: number
  item_1: number
  item_2: number
  item_3: number
  item_4: number
  item_5: number
  kills: number
  last_hits: number
  leaver_status: number
  level: number
  net_worth: number
  obs_placed: number
  radiant_win: boolean | null
  sen_placed: number
  stuns: number
  teamfight_participation: number | null
  tower_damage: number
  xp_per_min: number
  personaname: string | null
  name: string | null
  radiant: boolean
  kills_log: KillLog[] | null
  purchase: Record<string, number> | null
}

export type Match = {
  match_id: number
  barracks_status_dire: number
  barracks_status_radiant: number
  cluster: number
  dire_score: number
  dire_team_id: number | null
  duration: number
  engine: number
  first_blood_time: number
  game_mode: number
  human_players: number
  leagueid: number
  lobby_type: number
  match_seq_num: number
  negative_votes: number
  objectives: Objective[] | null
  picks_bans: PickBan[] | null
  positive_votes: number
  radiant_gold_adv: number[] | null
  radiant_score: number
  radiant_team_id: number | null
  radiant_win: boolean
  radiant_xp_adv: number[] | null
  skill: number | null
  start_time: number
  teamfights: Teamfight[] | null
  tower_status_dire: number
  tower_status_radiant: number
  version: number | null
  series_id: number | null
  series_type: number | null
  players: MatchPlayer[]
}
