import { Elysia } from 'elysia'
import type { HeroStat } from 'types'
import { fetchCached } from '../lib/opendota'

const TTL = 60 * 60 * 6 // 6 hours

export const heroesPlugin = new Elysia().get(
  '/heroes',
  async () => fetchCached('/heroStats', TTL) as Promise<HeroStat[]>,
)
