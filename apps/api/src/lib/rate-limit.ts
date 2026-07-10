// In-memory per-IP rate limiter. This API is fully public/read-only with no
// user accounts, so there's no benefit to a DB-backed limiter like the
// sibling bms/erp repos use (would just add a round-trip to every request for
// a single-machine deployment) — an in-memory fixed window is the right fit.
// Resets naturally on deploy/restart, which is fine for abuse mitigation.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Sweep expired buckets periodically so the map doesn't grow unbounded.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  },
  5 * 60 * 1000,
).unref()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfter: 0 }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('fly-client-ip') ?? request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() ?? 'unknown'
}
