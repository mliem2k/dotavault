// Thin wrappers over vendored dotaconstants data (the same data OpenDota's
// /constants endpoints serve). The files under ./dotaconstants/ are copied
// from the installed package by scripts/update-dotaconstants.sh, because
// the package's exports map blocks subpath JSON imports and importing its
// root would drag megabytes of unused data into the bundle.
import clusterMap from './dotaconstants/cluster.json'
import gameModes from './dotaconstants/game_mode.json'
import lobbyTypes from './dotaconstants/lobby_type.json'
import orderTypes from './dotaconstants/order_types.json'
import playerColors from './dotaconstants/player_colors.json'
import regions from './dotaconstants/region.json'

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function regionName(cluster: number | null | undefined): string | null {
  if (cluster == null) return null
  const regionId = (clusterMap as Record<string, number>)[String(cluster)]
  if (regionId == null) return null
  const name = (regions as Record<string, string>)[String(regionId)]
  return name ? titleCase(name) : null
}

export function gameModeName(id: number | null | undefined): string | null {
  if (id == null) return null
  const entry = (gameModes as Record<string, { name: string }>)[String(id)]
  if (!entry) return null
  return titleCase(entry.name.replace('game_mode_', '').replace(/_/g, ' '))
}

export function lobbyTypeName(id: number | null | undefined): string | null {
  if (id == null) return null
  const entry = (lobbyTypes as Record<string, { name: string }>)[String(id)]
  if (!entry) return null
  return titleCase(entry.name.replace('lobby_type_', '').replace(/_/g, ' '))
}

// Standard in-game player colors by slot order (0-4 Radiant, 5-9 Dire).
export function playerColor(playerSlot: number): string {
  const idx = playerSlot < 128 ? playerSlot : playerSlot - 128 + 5
  return (playerColors as Record<string, string>)[String(idx)] ?? '#8a97a0'
}

// Friendly label for an action/order type id (players[].actions keys).
export function orderTypeName(id: string): string {
  const raw = (orderTypes as Record<string, string>)[id]
  if (!raw) return `Order ${id}`
  return titleCase(raw.replace('DOTA_UNIT_ORDER_', '').replace(/_/g, ' '))
}

// Rune ids as used by OpenDota's runes_log keys.
export const RUNE_NAMES: Record<string, string> = {
  '0': 'Double Damage',
  '1': 'Haste',
  '2': 'Illusion',
  '3': 'Invisibility',
  '4': 'Regeneration',
  '5': 'Bounty',
  '6': 'Arcane',
  '7': 'Water',
  '8': 'Wisdom',
  '9': 'Shield',
}
