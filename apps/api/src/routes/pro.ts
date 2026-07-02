import { Elysia } from 'elysia'
import type { ProMatch, ProPlayer } from 'types'
import { fetchCached } from '../lib/opendota'

export const proPlugin = new Elysia({ prefix: '/pro' })
  .get('/matches', async () => fetchCached('/proMatches', 60 * 30) as Promise<ProMatch[]>)
  .get('/players', async () => fetchCached('/proPlayers', 60 * 60) as Promise<ProPlayer[]>)
