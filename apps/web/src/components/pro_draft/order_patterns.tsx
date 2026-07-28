import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ProMetaHeroRow } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { useSort } from '@/lib/sortable'
import { heroIconUrl, heroSlug } from '@/lib/utils'
import { averageOrder, bucketTotal, sortNullsLast } from './order_math'

/* Where in the Captains Mode draft each hero tends to go. Order buckets are
   only populated from Captains Mode matches (see the API's CAPTAINS_MODE
   filter), so a hero with no CM appearances shows no order data. */

const PANEL_BG = 'rgba(12,11,14,0.72)'

// A hero needs a few tracked draft actions before an average slot means
// anything; one lone ban would otherwise top the "earliest banned" sort.
const MIN_ORDER_SAMPLE = 5

type OrderSortKey = 'pickOrder' | 'banOrder' | 'picks' | 'bans'

export function OrderPatterns({ heroes }: { heroes: ProMetaHeroRow[] }) {
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 5 * 60 * 1000,
  })
  const heroById = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, h])),
    [heroStats.data],
  )

  const rows = useMemo(
    () =>
      heroes
        .map((h) => ({
          hero: h,
          avgPick: averageOrder(h.pickOrder),
          avgBan: averageOrder(h.banOrder),
          pickCount: bucketTotal(h.pickOrder),
          banCount: bucketTotal(h.banOrder),
        }))
        .filter((r) => r.pickCount + r.banCount >= MIN_ORDER_SAMPLE),
    [heroes],
  )

  const { key, dir, onSort } = useSort<OrderSortKey>('banOrder', 'asc')
  // Heroes with no value for the active column sink to the bottom, in both
  // sort directions, via sortNullsLast (see order_math.ts for why a
  // +Infinity sentinel through applySort cannot do this).
  const getValue: Record<OrderSortKey, (r: (typeof rows)[number]) => number | null> = {
    pickOrder: (r) => r.avgPick,
    banOrder: (r) => r.avgBan,
    picks: (r) => r.pickCount,
    bans: (r) => r.banCount,
  }
  const sorted = sortNullsLast(rows, dir, getValue[key])

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div
        className="border border-border p-4 text-[13px] text-muted"
        style={{ background: PANEL_BG }}
      >
        No Captains Mode draft order data yet for this patch.
      </div>
    )
  }

  const fmt = (v: number | null) => (v == null ? '-' : v.toFixed(1))

  return (
    <div className="border border-border" style={{ background: PANEL_BG }}>
      <div className="px-4 py-3 border-b border-border font-display uppercase text-[18px] tracking-[2px]">
        Draft Order
      </div>
      <div className="px-4 py-2 text-[12px] text-muted">
        Average slot in the Captains Mode draft, counting from 0. Lower means earlier.
      </div>
      <div className="px-4 pb-2">
        <div className="flex items-center gap-3 py-2 text-[12px] uppercase text-muted font-dota border-b border-border">
          <span className="min-w-0 flex-1">Hero</span>
          <SortHeader
            label="Avg Ban"
            sortKey="banOrder"
            active={key === 'banOrder'}
            dir={dir}
            onClick={onSort}
            className="w-20 shrink-0 justify-end"
          />
          <SortHeader
            label="Bans"
            sortKey="bans"
            active={key === 'bans'}
            dir={dir}
            onClick={onSort}
            className="w-16 shrink-0 justify-end"
          />
          <SortHeader
            label="Avg Pick"
            sortKey="pickOrder"
            active={key === 'pickOrder'}
            dir={dir}
            onClick={onSort}
            className="w-20 shrink-0 justify-end"
          />
          <SortHeader
            label="Picks"
            sortKey="picks"
            active={key === 'picks'}
            dir={dir}
            onClick={onSort}
            className="w-16 shrink-0 justify-end"
          />
        </div>
        {sorted.map((r, i) => {
          const hero = heroById.get(r.hero.heroId)
          return (
            <a
              key={r.hero.heroId}
              href={hero ? `/hero/${heroSlug(hero.localized_name)}` : '#'}
              className={`flex items-center gap-3 py-2 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {hero && (
                  <img
                    src={heroIconUrl(hero.name)}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="h-8 w-8 shrink-0"
                  />
                )}
                <span className="truncate text-[14px] font-dota">
                  {hero?.localized_name ?? r.hero.heroId}
                </span>
              </span>
              <span className="w-20 shrink-0 text-right text-[14px] tabular-nums text-dire font-dota">
                {fmt(r.avgBan)}
              </span>
              <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-muted font-dota">
                {r.banCount}
              </span>
              <span className="w-20 shrink-0 text-right text-[14px] tabular-nums text-radiant font-dota">
                {fmt(r.avgPick)}
              </span>
              <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-muted font-dota">
                {r.pickCount}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
