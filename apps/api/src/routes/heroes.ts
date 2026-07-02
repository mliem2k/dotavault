import { Elysia, t } from 'elysia'
import type { HeroStat } from 'types'
import { fetchCached } from '../lib/opendota'

const TTL = 60 * 60 * 6 // 6 hours

export const heroesPlugin = new Elysia()
  .get('/heroes', async () => fetchCached('/heroStats', TTL) as Promise<HeroStat[]>)
  .get(
    '/hero/:id',
    async ({ params }) => {
      const [durations, timings] = await Promise.all([
        fetchCached(`/heroes/${params.id}/durations`, TTL),
        fetchCached(`/heroes/${params.id}/itemTimings`, TTL),
      ])
      return { durations, timings }
    },
    { params: t.Object({ id: t.String() }) }
  )
