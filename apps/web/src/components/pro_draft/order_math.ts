import type { ProMetaOrderBucket } from 'types'

// Weighted mean of the draft slots a hero was picked or banned at. Null when
// there is no data at all, so callers can render a placeholder instead of a
// misleading 0 (which is a real, meaningful slot: the very first action).
// Accepts undefined on purpose. CI auto-deploys the web app while the API is
// deployed by hand (see the plan's deployment note), so a new frontend
// reliably runs against an API that predates these fields for some window.
// Typed as required on ProMetaHeroRow, but absent in that real payload.
export function averageOrder(buckets: ProMetaOrderBucket[] | undefined): number | null {
  let weighted = 0
  let total = 0
  for (const b of buckets ?? []) {
    weighted += b.order * b.count
    total += b.count
  }
  return total === 0 ? null : weighted / total
}

export function bucketTotal(buckets: ProMetaOrderBucket[] | undefined): number {
  return (buckets ?? []).reduce((sum, b) => sum + b.count, 0)
}
