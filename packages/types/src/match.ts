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
  // Sparse death-location heatmap: { x: { y: count } }, world grid cells
  // (same ~64-192 range as ward log x/y) — populated only for the players
  // who actually died in this fight, only at their death spot(s).
  deaths_pos: Record<string, Record<string, number>>
  ability_uses: Record<string, number>
  item_uses: Record<string, number>
  // Victim internal hero name -> kill count within this fight.
  killed: Record<string, number>
  buybacks: number
  damage: number
  deaths: number
  gold_delta: number
  healing: number
  xp_delta: number
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
  components?: string[] | null
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
  bkbpierce?: string
  dispellable?: string
  is_innate?: boolean
  attrib?: AbilityAttrib[]
  lore?: string
  mc?: number | number[] | string | boolean
  cd?: number | number[] | string
}

export type AghsDesc = {
  hero_name: string
  hero_id: number
  has_scepter: boolean
  scepter_desc: string
  scepter_skill_name: string
  scepter_new_skill: boolean
  has_shard: boolean
  shard_desc: string
  shard_skill_name: string
  shard_new_skill: boolean
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
  dn_t?: number[] | null
  xp_t: number[] | null
  obs_log: WardLog[] | null
  sen_log: WardLog[] | null
  obs_left_log?: WardLog[] | null
  sen_left_log?: WardLog[] | null
  rank_tier: number | null
  benchmarks: PlayerBenchmarks | null
  ability_upgrades_arr: number[] | null
  damage: Record<string, number> | null
  damage_taken: Record<string, number> | null
  damage_inflictor: Record<string, number> | null
  // Parsed-only extras used by the combat / performance / farm tabs.
  killed?: Record<string, number> | null
  gold_reasons?: Record<string, number> | null
  xp_reasons?: Record<string, number> | null
  lane_efficiency_pct?: number | null
  actions_per_min?: number | null
  camps_stacked?: number | null
  rune_pickups?: number | null
  buyback_count?: number | null
  pings?: number | null
  total_gold?: number | null
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
  replay_url?: string | null
  replay_salt?: number | null
  series_id: number | null
  series_type: number | null
  chat: ChatMessage[] | null
  players: MatchPlayer[]
}
