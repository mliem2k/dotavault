import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ProMetaHeroRow } from 'types'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { fetchProMeta } from '@/lib/pro_meta'
import { usePageTitle } from '@/lib/title'
import { heroIconUrl, heroSlug } from '@/lib/utils'
import { HeroPairs } from './hero_pairs'
import { OrderPatterns } from './order_patterns'

/* Pro Draft page: draft-shaped stats pulled out of the Pro Meta hero table
   into a purpose-built view. Sections 1 and 2 here read the existing
   /pro/meta response; the order and pair sections below them read their own
   data and render independently, so a still-warming ingest never blanks the
   whole page. */

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const PANEL_BG = 'rgba(12,11,14,0.72)'

function HeadlineStat({
  label,
  value,
  sample,
  variant,
}: {
  label: string
  value: number
  sample: number
  variant: 'radiant' | 'dire'
}) {
  return (
    <div className="border border-border p-3" style={{ background: PANEL_BG }}>
      <div className="text-[12px] uppercase text-muted mb-1">{label}</div>
      <div
        className={`font-dota text-[24px] ${variant === 'radiant' ? 'text-radiant' : 'text-dire'}`}
      >
        {pct(value)}
      </div>
      <div className="text-[11px] text-muted">{sample} matches</div>
    </div>
  )
}

const CONTESTED_LIMIT = 20

function MostContested({ heroes }: { heroes: ProMetaHeroRow[] }) {
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 5 * 60 * 1000,
  })
  const heroById = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, h])),
    [heroStats.data],
  )

  const top = useMemo(
    () => [...heroes].sort((a, b) => b.pickBanRate - a.pickBanRate).slice(0, CONTESTED_LIMIT),
    [heroes],
  )

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="border border-border" style={{ background: PANEL_BG }}>
      <div className="px-4 py-3 border-b border-border font-display uppercase text-[18px] tracking-[2px]">
        Most Contested
      </div>
      <div className="px-4 py-2">
        {top.map((h, i) => {
          const hero = heroById.get(h.heroId)
          return (
            <a
              key={h.heroId}
              href={hero ? `/hero/${heroSlug(hero.localized_name)}` : '#'}
              className={`flex items-center gap-3 py-2 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
            >
              <span className="w-5 text-right text-[13px] tabular-nums text-muted font-dota">
                {i + 1}
              </span>
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
              <span className="min-w-0 flex-1 truncate text-[14px] font-dota">
                {hero?.localized_name ?? h.heroId}
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-muted font-dota">
                {h.picks}P / {h.bans}B
              </span>
              <span className="w-16 shrink-0 text-right text-[15px] tabular-nums text-gold font-dota">
                {pct(h.pickBanRate)}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export function ProDraftView() {
  usePageTitle('Pro Draft')
  const query = useQuery({
    queryKey: ['pro-meta'],
    queryFn: fetchProMeta,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (query.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="py-20 text-center text-muted">
        Pro draft stats are still being computed for the current patch. Check back shortly.
      </div>
    )
  }

  const data = query.data
  if (!data) return null
  if (data.totalMatches === 0) {
    return (
      <div className="py-20 text-center text-muted">
        Not enough tournament matches recorded yet for patch {data.patch.name}.
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
      <div>
        <h1
          className="text-[44px] leading-none font-bold uppercase text-foreground font-display"
          style={{ letterSpacing: '2px' }}
        >
          Pro Draft
        </h1>
        <p className="mt-2 text-[13px] uppercase tracking-[0.2em] text-foreground font-dota">
          Side and pick advantage, contested heroes, draft order, and hero pairings
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 font-dota">
        <Badge variant="pro">Patch {data.patch.name}</Badge>
        <span className="text-[13px] text-muted">
          {data.totalMatches} pro matches sampled
          {data.truncated ? ' (sample capped)' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <HeadlineStat
          label="Radiant Winrate"
          value={data.aggregate.radiantWinrate}
          sample={data.totalMatches}
          variant="radiant"
        />
        <HeadlineStat
          label="Dire Winrate"
          value={data.aggregate.direWinrate}
          sample={data.totalMatches}
          variant="dire"
        />
        <HeadlineStat
          label="First Pick Winrate"
          value={data.aggregate.firstPickWinrate}
          sample={data.aggregate.draftedMatches}
          variant="radiant"
        />
        <HeadlineStat
          label="Second Pick Winrate"
          value={data.aggregate.secondPickWinrate}
          sample={data.aggregate.draftedMatches}
          variant="dire"
        />
      </div>

      <MostContested heroes={data.heroes} />

      <OrderPatterns heroes={data.heroes} />

      <HeroPairs />
    </div>
  )
}
