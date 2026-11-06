// Public read-only API: an in-process fixed-window limiter is enough. The
// shared implementation keeps the same behavior and supports Fly/GCP IPs.
import { createMemoryRateLimiter } from '@mliem2k/kit/api/memory-rate-limit'

export const checkRateLimit = createMemoryRateLimiter()
export { getClientIp as clientIp } from '@mliem2k/kit/api/ip'
