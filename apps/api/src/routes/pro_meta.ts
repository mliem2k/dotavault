import { Elysia } from 'elysia'
import { getProMeta } from '../lib/pro_meta'

export const proMetaPlugin = new Elysia({ prefix: '/pro' }).get('/meta', async ({ set }) => {
  const result = await getProMeta()
  if (result === null) {
    set.status = 503
    return { error: 'pro meta not available yet, try again shortly' }
  }
  return result
})
