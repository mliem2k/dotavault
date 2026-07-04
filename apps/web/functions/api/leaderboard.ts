// Cloudflare Pages Function: same-origin proxy for Valve's public Dota 2
// leaderboard webapi (isn't CORS-accessible). Served at /api/leaderboard?division=<div>.
// e.g. /api/leaderboard?division=europe
//
// Compiled by Wrangler at deploy time (not by the Vite build), so this file is
// intentionally dependency-free and loosely typed.

const ALLOWED_DIVISIONS = new Set(['americas', 'europe', 'se_asia', 'china'])

type Ctx = {
  request: Request
}

export const onRequestGet = async (context: Ctx): Promise<Response> => {
  const url = new URL(context.request.url)
  const division = url.searchParams.get('division') ?? ''

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
    })

  if (!ALLOWED_DIVISIONS.has(division)) return json({ error: 'invalid division' }, 400)

  const upstream = `https://www.dota2.com/webapi/ILeaderboard/GetDivisionLeaderboard/v0001?division=${division}&leaderboard=0`

  const res = await fetch(upstream, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; dotavault/1.0)',
      accept: 'application/json',
    },
    // Valve republishes this roughly every hour — cache well under that.
    cf: { cacheTtl: 1800, cacheEverything: true },
  } as RequestInit)

  if (!res.ok) return json({ error: `upstream ${res.status}` }, 502)

  return new Response(await res.text(), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=1800, stale-while-revalidate=3600',
    },
  })
}
