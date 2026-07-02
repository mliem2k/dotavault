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

export type ChatMessage = {
  time: number
  type: string
  key: string
  slot: number
  player_slot: number
  unit?: string
}

export type WardLog = {
  time: number
  x: number
  y: number
  entityleft?: boolean
}

export type Benchmark = { raw: number; pct: number }

export type PlayerBenchmarks = {
  gold_per_min?: Benchmark
  xp_per_min?: Benchmark
  kills_per_min?: Benchmark
  last_hits_per_min?: Benchmark
  hero_damage_per_min?: Benchmark
  hero_healing_per_min?: Benchmark
  tower_damage?: Benchmark
}

export type HeroBenchmarks = {
  hero_id: number
  result: Record<string, { percentile: number; value: number }[]>
}

export type ItemAttrib = { key: string; value: string | number; display?: string }

export type ItemConst = {
  id: number
  img: string
  dname?: string
  cost?: number | null
  qual?: string
  notes?: string
  hint?: string[]
  attrib?: ItemAttrib[]
  mc?: number | boolean
  cd?: number | boolean
  lore?: string
}

export type AbilityAttrib = { key: string; header?: string; value: string | string[]; generated?: boolean }

export type AbilityConst = {
  dname?: string
  img?: string
  desc?: string
  behavior?: string | string[]
  dmg_type?: string
  attrib?: AbilityAttrib[]
  lore?: string
  mc?: number | number[] | string | boolean
  cd?: number | number[] | string
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
  item_neutral: number
  aghanims_scepter: number
  aghanims_shard: number
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
  lane_role: number | null
  kills_log: KillLog[] | null
  purchase: Record<string, number> | null
  purchase_log: { key: string; time: number }[] | null
  gold_t: number[] | null
  lh_t: number[] | null
  xp_t: number[] | null
  obs_log: WardLog[] | null
  sen_log: WardLog[] | null
  rank_tier: number | null
  benchmarks: PlayerBenchmarks | null
  ability_upgrades_arr: number[] | null
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
  chat: ChatMessage[] | null
  players: MatchPlayer[]
}
