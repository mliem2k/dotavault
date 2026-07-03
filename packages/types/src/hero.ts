// Compact per-hero data from Valve's datafeed, baked into public/hero_meta.json.
export type HeroMeta = {
  tagline: string
  // hype = the short header blurb dota2.com shows; bio = the full history behind "Read Full History".
  hype: string
  bio: string
  complexity: number
  str_base: number
  str_gain: number
  agi_base: number
  agi_gain: number
  int_base: number
  int_gain: number
  damage_min: number
  damage_max: number
  attack_rate: number
  attack_range: number
  projectile_speed: number
  armor: number
  magic_resistance: number
  movement_speed: number
  turn_rate: number
  sight_range_day: number
  sight_range_night: number
  max_health: number
  health_regen: number
  max_mana: number
  mana_regen: number
  // Role emphasis 0..3, ordered Carry, Support, Nuker, Disabler, Jungler, Durable, Escape, Pusher, Initiator.
  role_levels: number[]
}

export type HeroStat = {
  id: number
  name: string
  localized_name: string
  primary_attr: string
  attack_type: string
  roles: string[]
  img: string
  icon: string
  base_health: number
  base_mana: number
  base_armor: number
  base_attack_min: number
  base_attack_max: number
  base_str: number
  base_agi: number
  base_int: number
  str_gain: number
  agi_gain: number
  int_gain: number
  attack_range: number
  move_speed: number
  hero_id: number
  turbo_picks: number
  turbo_wins: number
  pro_ban: number
  pro_win: number
  pro_pick: number
  '1_pick': number
  '1_win': number
  '2_pick': number
  '2_win': number
  '3_pick': number
  '3_win': number
  '4_pick': number
  '4_win': number
  '5_pick': number
  '5_win': number
  '6_pick': number
  '6_win': number
  '7_pick': number
  '7_win': number
  '8_pick': number
  '8_win': number
  null_pick: number
  null_win: number
}
