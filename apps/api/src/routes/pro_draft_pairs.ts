import { Elysia } from 'elysia'
import { getProDraftPairs } from '../lib/pro_draft_pairs'

export const proDraftPairsPlugin = new Elysia({ prefix: '/pro' }).get(
  '/draft-pairs',
  async ({ set }) => {
    const result = await getProDraftPairs()
    if (result === null) {
      set.status = 503
      return { error: 'pro draft pairs not available yet, try again shortly' }
    }
    return result
  },
)
