// Cloudflare Pages Function: same-origin, edge-cached proxy for Valve's Dota 2
// datafeed (which isn't CORS-accessible). Served at /df/<path>?<query>.
// e.g. /df/herodata?language=english&hero_id=2
//
// Compiled by Wrangler at deploy time (not by the Vite build), so this file is
// intentionally dependency-free and loosely typed.

// Only proxy the read-only datafeed endpoints we actually use.
const ALLOWED = new Set(['herodata', 'herolist', 'itemdata', 'itemlist'])

type Ctx = {
  request: Request
  params: { path?: string | string[] }
}

export const onRequestGet = async (context: Ctx): Promise<Response> => {
  const raw = context.params.path
  const path = Array.isArray(raw) ? raw.join('/') : (raw ?? '')
  const endpoint = path.split('/')[0]

  const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra },
    })

  if (!ALLOWED.has(endpoint)) return json({ error: 'not found' }, 404)

  const search = new URL(context.request.url).search
  const upstream = `https://www.dota2.com/datafeed/${path}${search}`

  const res = await fetch(upstream, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; dotavault/1.0)',
      accept: 'application/json',
      referer: 'https://www.dota2.com/heroes',
    },
    // Cache aggressively at the edge — datafeed data only changes on patches.
    cf: { cacheTtl: 86400, cacheEverything: true },
  } as RequestInit)

  if (!res.ok) return json({ error: `upstream ${res.status}` }, 502)

  return new Response(await res.text(), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
