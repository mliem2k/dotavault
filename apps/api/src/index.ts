import { cron } from '@elysiajs/cron'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { deleteExpired } from './lib/cache'
import { env } from './lib/env'
import { heroesPlugin } from './routes/heroes'
import { matchesPlugin } from './routes/matches'
import { playersPlugin } from './routes/players'
import { proPlugin } from './routes/pro'
import { replayPlugin } from './routes/replay'
import { searchPlugin } from './routes/search'

const app = new Elysia()
  .use(
    openapi({
      path: '/docs',
      documentation: { info: { title: 'dotavault API', version: '1.0.0' } },
    })
  )
  .use(
    cors({
      origin: ['https://dotavault.mliem.com', 'http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    })
  )
  .use(
    cron({
      name: 'cache-cleanup',
      pattern: '*/30 * * * *',
      run: deleteExpired,
    })
  )
  .get('/health', () => ({ ok: true }))
  .use(playersPlugin)
  .use(matchesPlugin)
  .use(heroesPlugin)
  .use(proPlugin)
  .use(searchPlugin)
  .use(replayPlugin)
  .listen(env.PORT)

console.log(`dotavault api running on port ${env.PORT}`)

export type App = typeof app
