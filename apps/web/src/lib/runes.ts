/* Static rune spawn locations on the same ~64-192 world grid as buildings.ts.
   Positions extracted from a real replay's entity data (CDOTA_Item_
   RuneSpawner_Bounty/Powerup, probe against testdata/fixture.dem.bz2 in
   apps/replay-parser), so these are spawn LANDMARKS only, like the building
   markers, not a simulated spawn/despawn timer: real spawn cadence turned
   out to differ by game mode (confirmed Turbo vs standard give different
   intervals in the same probe), so encoding one would likely be wrong for
   most matches rather than showing nothing. Wisdom runes have no separate
   spawner entity in this probe and are omitted. */

export type RuneSpot = {
  x: number
  y: number
  kind: 'bounty' | 'power'
}

export const RUNE_SPOTS: RuneSpot[] = [
  { x: 120.11, y: 162.31, kind: 'bounty' },
  { x: 132.32, y: 90.8, kind: 'bounty' },
  { x: 114.59, y: 136.34, kind: 'power' },
  { x: 136.61, y: 118.25, kind: 'power' },
]
