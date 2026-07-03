import type { HeroMeta } from 'types'

// Live access to Valve's Dota 2 datafeed via our same-origin /df proxy
// (Cloudflare Pages Function in prod, Vite proxy in dev).

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/df/${path}`)
  if (!res.ok) throw new Error(`datafeed ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

type RawHero = Record<string, number | string> & { npe_desc_loc?: string }

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
  const m = { tagline: h.npe_desc_loc ?? '' } as HeroMeta
  for (const f of NUM_FIELDS) {
    const v = h[f as keyof RawHero]
    ;(m as unknown as Record<string, number>)[f] =
      typeof v === 'number' ? Math.round(v * 100) / 100 : 0
  }
  const rl = (h as { role_levels?: unknown }).role_levels
  m.role_levels = Array.isArray(rl) ? (rl as number[]) : []
  return m
}

export const datafeed = {
  async heroData(heroId: number): Promise<HeroMeta> {
    const d = await get<{ result: { data: { heroes: RawHero[] } } }>(
      `herodata?language=english&hero_id=${heroId}`,
    )
    const h = d.result?.data?.heroes?.[0]
    if (!h) throw new Error('no hero data')
    return toMeta(h)
  },
}
