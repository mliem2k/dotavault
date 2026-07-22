import { cors } from '@elysiajs/cors'
import { cron } from '@elysiajs/cron'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { deleteExpired } from './lib/cache'
import { env } from './lib/env'
import { maybeRunProMetaTick } from './lib/pro_meta_tick'
import { checkRateLimit, clientIp } from './lib/rate-limit'
import { heroesPlugin } from './routes/heroes'
import { matchesPlugin } from './routes/matches'
import { playersPlugin } from './routes/players'
import { proPlugin } from './routes/pro'
import { proMetaPlugin } from './routes/pro_meta'
import { searchPlugin } from './routes/search'

// Generous general-purpose limit — this is a public read-only API with no
// per-user quota, just abuse mitigation.
const GENERAL_RATE_LIMIT = 240
const GENERAL_RATE_WINDOW_MS = 60_000

const app = new Elysia()
  .use(
    openapi({
      path: '/docs',
      documentation: { info: { title: 'dotavault API', version: '1.0.0' } },
    }),
  )
  .use(
    cors({
      origin: ['https://dotavault.mliem.com', 'http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    }),
  )
  .use(
    cron({
      name: 'cache-cleanup',
      pattern: '*/30 * * * *',
      run: deleteExpired,
    }),
  )
  .onRequest(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff'
    set.headers['X-Frame-Options'] = 'DENY'
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    set.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  })
  .onRequest(({ request }) => {
    // Excludes /health: Fly pings it every 30s regardless of real usage,
    // which would otherwise act as a fake cron and defeat scale-to-zero.
    const { pathname } = new URL(request.url)
    if (pathname === '/health') return
    maybeRunProMetaTick()
  })
  .onBeforeHandle(({ set, request }) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/health') return
    const { allowed, retryAfter } = checkRateLimit(
      clientIp(request),
      GENERAL_RATE_LIMIT,
      GENERAL_RATE_WINDOW_MS,
    )
    if (!allowed) {
      set.status = 429
      set.headers['Retry-After'] = String(retryAfter)
      return { error: 'Too many requests' }
    }
  })
  .get('/health', () => ({ ok: true }))
  .use(playersPlugin)
  .use(matchesPlugin)
  .use(heroesPlugin)
  .use(proPlugin)
  .use(proMetaPlugin)
  .use(searchPlugin)
  .listen(env.PORT)

console.log(`dotavault api running on port ${env.PORT}`)

export type App = typeof app
