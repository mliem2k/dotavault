import { Elysia, t } from 'elysia'
import type { SearchResult } from 'types'
import { fetchCached } from '../lib/opendota'

export const searchPlugin = new Elysia().get(
  '/search',
  async ({ query }) =>
    fetchCached(
      `/search?q=${encodeURIComponent(query.q)}`,
      60 * 15
    ) as Promise<SearchResult[]>,
  { query: t.Object({ q: t.String() }) }
)
