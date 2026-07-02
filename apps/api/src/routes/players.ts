import { Elysia, t } from 'elysia'
import type { Player, PlayerHero, PlayerMatch, PlayerWL } from 'types'
import { fetchCached } from '../lib/opendota'

const TTL = 60 * 60 // 1 hour

export const playersPlugin = new Elysia({ prefix: '/players' })
  .get(
    '/:id',
    async ({ params }) => {
      const [player, wl] = await Promise.all([
        fetchCached(`/players/${params.id}`, TTL) as Promise<Player>,
        fetchCached(`/players/${params.id}/wl`, TTL) as Promise<PlayerWL>,
      ])
      return { player, wl }
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    '/:id/matches',
    async ({ params, query }) => {
      const limit = query.limit ?? '20'
      return fetchCached(`/players/${params.id}/matches?limit=${limit}`, TTL) as Promise<
        PlayerMatch[]
      >
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ limit: t.Optional(t.String()) }),
    }
  )
  .get(
    '/:id/heroes',
    async ({ params }) =>
      fetchCached(`/players/${params.id}/heroes`, TTL) as Promise<PlayerHero[]>,
    { params: t.Object({ id: t.String() }) }
  )
