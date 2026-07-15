import type { HeroStat } from 'types'

// OpenDota's "Nuker" role tag means "has burst damage in its kit," not
// "commonly played mid" - several str/universal initiators (Clockwerk,
// Tusk, ...) carry it despite being practically always drafted offlane
// or roaming support. A stricter rule (e.g. excluding every
// Initiator-tagged hero) would also wrongly exclude genuine mid heroes
// like Puck and Pudge, who happen to share that same Initiator tag, so
// these are excluded explicitly instead of by a broader condition.
const MID_LANE_KIT_FALSE_POSITIVES = new Set([
  'Beastmaster',
  'Centaur Warrunner',
  'Clockwerk',
  'Dark Seer',
  'Earth Spirit',
  'Elder Titan',
  'Magnus',
  'Nyx Assassin',
  'Tusk',
])

// The 5 standard Dota positions, classified from OpenDota's heroStats roles
// array. Shared by the Meta and Pro Meta pages so hero-to-position
// classification never silently drifts between them.
export const LANES = [
  {
    pos: 1,
    label: 'Safe Lane',
    colorClass: 'text-radiant',
    filter: (h: HeroStat) => h.roles.includes('Carry'),
  },
  {
    pos: 2,
    label: 'Mid Lane',
    colorClass: 'text-int',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      !MID_LANE_KIT_FALSE_POSITIVES.has(h.localized_name) &&
      (h.roles.includes('Nuker') || h.primary_attr === 'int'),
  },
  {
    pos: 3,
    label: 'Off Lane',
    color: '#c97a3a',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      (h.roles.includes('Initiator') || h.roles.includes('Durable')),
  },
  {
    pos: 4,
    label: 'Soft Support',
    colorClass: 'text-uni',
    filter: (h: HeroStat) => h.roles.includes('Support') && !h.roles.includes('Disabler'),
  },
  {
    pos: 5,
    label: 'Hard Support',
    color: '#d94a8a',
    filter: (h: HeroStat) => h.roles.includes('Support') && h.roles.includes('Disabler'),
  },
]

export const ROLE_OPTIONS: { key: 'all' | (typeof LANES)[number]['pos']; label: string }[] = [
  { key: 'all', label: 'All Roles' },
  ...LANES.map((l) => ({ key: l.pos, label: l.label })),
]
