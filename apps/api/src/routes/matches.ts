import { Elysia, t } from 'elysia'
import type { Match } from 'types'
import { fetchCached } from '../lib/opendota'

export const matchesPlugin = new Elysia({ prefix: '/matches' }).get(
  '/:id',
  async ({ params }) => fetchCached(`/matches/${params.id}`, 60 * 60 * 24) as Promise<Match>,
  { params: t.Object({ id: t.String() }) },
)
