import type { HeroListItem, HeroMeta } from 'types'

// Live access to Valve's Dota 2 datafeed via our same-origin /df proxy
// (Cloudflare Pages Function in prod, Vite proxy in dev).

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/df/${path}`)
  if (!res.ok) throw new Error(`datafeed ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

type RawSpecialValue = {
  name: string
  values_float?: number[] | null
  values_int?: number[] | null
  bonuses?: { name: string; value: number }[] | null
}

type RawAbility = {
  name: string
  name_loc?: string
  desc_loc?: string
  special_values?: RawSpecialValue[] | null
}

type RawTalent = RawAbility

type RawHero = Record<string, number | string> & {
  npe_desc_loc?: string
  hype_loc?: string
  bio_loc?: string
  abilities?: RawAbility[]
  talents?: RawTalent[]
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(+v.toFixed(2))
}

// Resolve "{s:bonus_x}" placeholders in talent strings the way dota2.com does:
// the value lives either in the talent's own special_values, or in a hero
// ability's special_values entry whose `bonuses` list links this talent.
function resolveTalents(h: RawHero): { name: string; label: string }[] {
  const abilities = h.abilities ?? []
  const bonusFor = (talentName: string): number | null => {
    for (const a of abilities) {
      for (const sv of a.special_values ?? []) {
        for (const b of sv.bonuses ?? []) {
          if (b.name === talentName) return b.value
        }
      }
    }
    return null
  }
  return (h.talents ?? []).map((t) => {
    const label = (t.name_loc ?? '').replace(/\{s:([^}]+)\}/g, (_m, key: string) => {
      const own = (t.special_values ?? []).find((sv) => sv.name === key)
      const v = own?.values_float?.[0] ?? own?.values_int?.[0] ?? bonusFor(t.name)
      return v != null ? fmtNum(v) : ''
    })
    return { name: t.name, label: label.replace(/\s+/g, ' ').trim() }
  })
}

const NUM_FIELDS: (keyof HeroMeta)[] = [
  'complexity',
  'str_base',
  'str_gain',
  'agi_base',
  'agi_gain',
  'int_base',
  'int_gain',
  'damage_min',
  'damage_max',
  'attack_rate',
  'attack_range',
  'projectile_speed',
  'armor',
  'magic_resistance',
  'movement_speed',
  'turn_rate',
  'sight_range_day',
  'sight_range_night',
  'max_health',
  'health_regen',
  'max_mana',
  'mana_regen',
]

function toMeta(h: RawHero): HeroMeta {
  const m = {
    tagline: h.npe_desc_loc ?? '',
    hype: h.hype_loc ?? '',
    bio: h.bio_loc ?? '',
  } as HeroMeta
  for (const f of NUM_FIELDS) {
    const v = h[f as keyof RawHero]
    ;(m as unknown as Record<string, number>)[f] =
      typeof v === 'number' ? Math.round(v * 100) / 100 : 0
  }
  const rl = (h as { role_levels?: unknown }).role_levels
  m.role_levels = Array.isArray(rl) ? (rl as number[]) : []
  m.talents = resolveTalents(h)
  // Keyed by internal name AND lowercased display name — Valve occasionally
  // renames abilities (tidehunter_krill_eater vs tidehunter_leviathans_catch)
  // so OpenDota's internal names don't always match the datafeed's.
  const descs: Record<string, string> = {}
  for (const a of h.abilities ?? []) {
    const d = resolveDesc(a)
    if (!d) continue
    descs[a.name] = d
    if (a.name_loc) descs[a.name_loc.toLowerCase()] = d
  }
  m.abilityDescs = descs
  return m
}

// Substitute %special_value% placeholders and strip markup from a datafeed
// ability description.
function resolveDesc(a: RawAbility): string {
  const raw = a.desc_loc ?? ''
  if (!raw) return ''
  return raw
    .replace(/%([a-zA-Z0-9_]+)%/g, (_m, key: string) => {
      const sv = (a.special_values ?? []).find((v) => v.name === key)
      const vals = sv?.values_float ?? sv?.values_int
      if (!vals || vals.length === 0) return ''
      return [...new Set(vals)]
        .map((v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2))))
        .join('/')
    })
    .replace(/%%/g, '%')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const datafeed = {
  async heroList(): Promise<HeroListItem[]> {
    const d = await get<{ result: { data: { heroes: HeroListItem[] } } }>(
      'herolist?language=english',
    )
    return d.result?.data?.heroes ?? []
  },

  async heroData(heroId: number): Promise<HeroMeta> {
    const d = await get<{ result: { data: { heroes: RawHero[] } } }>(
      `herodata?language=english&hero_id=${heroId}`,
    )
    const h = d.result?.data?.heroes?.[0]
    if (!h) throw new Error('no hero data')
    return toMeta(h)
  },
}
