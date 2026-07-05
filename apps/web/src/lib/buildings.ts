import type { Match } from 'types'

/* Static building layout on the ~64-192 world grid (same coordinate space
   as OpenDota's ward/death positions). Exact positions extracted from a
   real replay's entity data (probe against match 8876027552); the map
   layout is fixed per patch. `key` matches OpenDota's objectives[].key for
   building_kill events and the players[].damage map keys. */

export type Building = {
  key: string
  team: 'radiant' | 'dire'
  x: number
  y: number
  kind: 'tower' | 'rax' | 'fort'
  label: string
  maxHp: number
}

const T1 = 1800
const T2 = 2500
const T3 = 2500
const T4 = 2600
const MELEE_RAX = 2200
const RANGE_RAX = 1300
const FORT = 4500

export const BUILDINGS: Building[] = [
  { key: 'npc_dota_goodguys_tower1_top', team: 'radiant', x: 78.25, y: 142.25, kind: 'tower', label: 'T1 Top', maxHp: T1 },
  { key: 'npc_dota_goodguys_tower1_mid', team: 'radiant', x: 114.97, y: 116.5, kind: 'tower', label: 'T1 Mid', maxHp: T1 },
  { key: 'npc_dota_goodguys_tower1_bot', team: 'radiant', x: 164.98, y: 78.08, kind: 'tower', label: 'T1 Bot', maxHp: T1 },
  { key: 'npc_dota_goodguys_tower2_top', team: 'radiant', x: 76.61, y: 120.59, kind: 'tower', label: 'T2 Top', maxHp: T2 },
  { key: 'npc_dota_goodguys_tower2_mid', team: 'radiant', x: 102.54, y: 104.57, kind: 'tower', label: 'T2 Mid', maxHp: T2 },
  { key: 'npc_dota_goodguys_tower2_bot', team: 'radiant', x: 124.59, y: 78.56, kind: 'tower', label: 'T2 Bot', maxHp: T2 },
  { key: 'npc_dota_goodguys_tower3_top', team: 'radiant', x: 76.25, y: 100.69, kind: 'tower', label: 'T3 Top', maxHp: T3 },
  { key: 'npc_dota_goodguys_tower3_mid', team: 'radiant', x: 90.88, y: 94.81, kind: 'tower', label: 'T3 Mid', maxHp: T3 },
  { key: 'npc_dota_goodguys_tower3_bot', team: 'radiant', x: 96.56, y: 80.12, kind: 'tower', label: 'T3 Bot', maxHp: T3 },
  { key: 'npc_dota_goodguys_tower4', team: 'radiant', x: 82.69, y: 90.0, kind: 'tower', label: 'T4 Top', maxHp: T4 },
  { key: 'npc_dota_goodguys_tower4', team: 'radiant', x: 84.94, y: 86.72, kind: 'tower', label: 'T4 Bot', maxHp: T4 },
  { key: 'npc_dota_goodguys_melee_rax_top', team: 'radiant', x: 78.25, y: 98.32, kind: 'rax', label: 'Melee Rax Top', maxHp: MELEE_RAX },
  { key: 'npc_dota_goodguys_range_rax_top', team: 'radiant', x: 74.27, y: 98.32, kind: 'rax', label: 'Ranged Rax Top', maxHp: RANGE_RAX },
  { key: 'npc_dota_goodguys_melee_rax_mid', team: 'radiant', x: 90.75, y: 92.22, kind: 'rax', label: 'Melee Rax Mid', maxHp: MELEE_RAX },
  { key: 'npc_dota_goodguys_range_rax_mid', team: 'radiant', x: 88.23, y: 94.6, kind: 'rax', label: 'Ranged Rax Mid', maxHp: RANGE_RAX },
  { key: 'npc_dota_goodguys_melee_rax_bot', team: 'radiant', x: 94.28, y: 78.16, kind: 'rax', label: 'Melee Rax Bot', maxHp: MELEE_RAX },
  { key: 'npc_dota_goodguys_range_rax_bot', team: 'radiant', x: 94.29, y: 82.14, kind: 'rax', label: 'Ranged Rax Bot', maxHp: RANGE_RAX },
  { key: 'npc_dota_goodguys_fort', team: 'radiant', x: 80.88, y: 86.09, kind: 'fort', label: 'Ancient', maxHp: FORT },
  { key: 'npc_dota_badguys_tower1_top', team: 'dire', x: 86.4, y: 174.58, kind: 'tower', label: 'T1 Top', maxHp: T1 },
  { key: 'npc_dota_badguys_tower1_mid', team: 'dire', x: 132.05, y: 132.55, kind: 'tower', label: 'T1 Mid', maxHp: T1 },
  { key: 'npc_dota_badguys_tower1_bot', team: 'dire', x: 176.49, y: 110.25, kind: 'tower', label: 'T1 Bot', maxHp: T1 },
  { key: 'npc_dota_badguys_tower2_top', team: 'dire', x: 126.5, y: 174.5, kind: 'tower', label: 'T2 Top', maxHp: T2 },
  { key: 'npc_dota_badguys_tower2_mid', team: 'dire', x: 146.75, y: 144.25, kind: 'tower', label: 'T2 Mid', maxHp: T2 },
  { key: 'npc_dota_badguys_tower2_bot', team: 'dire', x: 178.0, y: 130.5, kind: 'tower', label: 'T2 Bot', maxHp: T2 },
  { key: 'npc_dota_badguys_tower3_top', team: 'dire', x: 154.88, y: 172.56, kind: 'tower', label: 'T3 Top', maxHp: T3 },
  { key: 'npc_dota_badguys_tower3_mid', team: 'dire', x: 160.69, y: 156.68, kind: 'tower', label: 'T3 Mid', maxHp: T3 },
  { key: 'npc_dota_badguys_tower3_bot', team: 'dire', x: 176.75, y: 150.84, kind: 'tower', label: 'T3 Bot', maxHp: T3 },
  { key: 'npc_dota_badguys_tower4', team: 'dire', x: 166.31, y: 164.66, kind: 'tower', label: 'T4 Top', maxHp: T4 },
  { key: 'npc_dota_badguys_tower4', team: 'dire', x: 168.62, y: 162.31, kind: 'tower', label: 'T4 Bot', maxHp: T4 },
  { key: 'npc_dota_badguys_melee_rax_top', team: 'dire', x: 158.23, y: 170.47, kind: 'rax', label: 'Melee Rax Top', maxHp: MELEE_RAX },
  { key: 'npc_dota_badguys_range_rax_top', team: 'dire', x: 158.21, y: 174.54, kind: 'rax', label: 'Ranged Rax Top', maxHp: RANGE_RAX },
  { key: 'npc_dota_badguys_melee_rax_mid', team: 'dire', x: 164.37, y: 156.94, kind: 'rax', label: 'Melee Rax Mid', maxHp: MELEE_RAX },
  { key: 'npc_dota_badguys_range_rax_mid', team: 'dire', x: 160.94, y: 160.34, kind: 'rax', label: 'Ranged Rax Mid', maxHp: RANGE_RAX },
  { key: 'npc_dota_badguys_melee_rax_bot', team: 'dire', x: 178.75, y: 154.25, kind: 'rax', label: 'Melee Rax Bot', maxHp: MELEE_RAX },
  { key: 'npc_dota_badguys_range_rax_bot', team: 'dire', x: 174.69, y: 154.19, kind: 'rax', label: 'Ranged Rax Bot', maxHp: RANGE_RAX },
  { key: 'npc_dota_badguys_fort', team: 'dire', x: 170.59, y: 166.53, kind: 'fort', label: 'Ancient', maxHp: FORT },
]

export const MAP_MIN = 64
export const MAP_MAX = 192

/* Destruction time per BUILDINGS entry (Infinity = survived). Duplicate keys
   (the two tier-4 towers) consume matching kill events in order. */
export function buildingDeathTimes(match: Match): number[] {
  const deaths = BUILDINGS.map(() => Number.POSITIVE_INFINITY)
  const kills = (match.objectives ?? []).filter((o) => o.type === 'building_kill' && o.key)
  for (const ev of [...kills].sort((a, b) => a.time - b.time)) {
    const idx = BUILDINGS.findIndex(
      (b, i) => deaths[i] === Number.POSITIVE_INFINITY && ev.key?.includes(b.key),
    )
    if (idx !== -1) deaths[idx] = ev.time
  }
  return deaths
}
