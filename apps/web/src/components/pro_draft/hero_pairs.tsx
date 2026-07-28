import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { HeroStat } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { fetchProDraftPairs } from '@/lib/pro_draft_pairs'
import { heroIconUrl } from '@/lib/utils'
import { type PairView, topPartners, worstMatchups } from './pair_math'

/* Hero synergies and counters. Rendered as two hero-scoped lists rather
   than a full NxN heatmap: the heatmap is a follow-up that needs no further
   backend work, since it reads this same endpoint. */

const PANEL_BG = 'rgba(12,11,14,0.72)'

// Any individual pair is rare (each match contributes only 20 same-team and
// 25 opposing pairs), so this floor is deliberately lower than the Pro Meta
// page's per-hero MIN_SAMPLE of 10. Sample size is always displayed next to
// the rate so a thin result is visible as thin.
const MIN_PAIR_SAMPLE = 5
const LIST_LIMIT = 8

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function PairList({
  title,
  views,
  heroById,
  tone,
}: {
  title: string
  views: PairView[]
  heroById: Map<number, HeroStat>
  tone: 'radiant' | 'dire'
}) {
  return (
    <div>
      <div className="text-[12px] uppercase text-muted mb-2">{title}</div>
      {views.length === 0 && (
        <div className="text-[13px] text-muted py-2">
          Not enough games yet at this sample floor.
        </div>
      )}
      {views.map((v, i) => {
        const hero = heroById.get(v.partner)
        return (
          <div
            key={v.partner}
            className={`flex items-center gap-2 py-1.5 ${i === 0 ? '' : 'border-t border-border'}`}
          >
            {hero && (
              <img
                src={heroIconUrl(hero.name)}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                className="h-7 w-7 shrink-0"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] font-dota">
              {hero?.localized_name ?? v.partner}
            </span>
            <span
              className={`shrink-0 text-[14px] tabular-nums font-dota ${tone === 'radiant' ? 'text-radiant' : 'text-dire'}`}
            >
              {pct(v.winrate)}
            </span>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted font-dota">
              {v.sample}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function HeroPairs() {
  const pairs = useQuery({
    queryKey: ['pro-draft-pairs'],
    queryFn: fetchProDraftPairs,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 5 * 60 * 1000,
  })

  const heroById = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, h])),
    [heroStats.data],
  )
  const sortedHeroes = useMemo(
    () =>
      [...(heroStats.data ?? [])].sort((a, b) => a.localized_name.localeCompare(b.localized_name)),
    [heroStats.data],
  )

  const [heroId, setHeroId] = useState<number | null>(null)

  const rows = pairs.data?.pairs ?? []
  const partners = useMemo(
    () => (heroId == null ? [] : topPartners(rows, heroId, MIN_PAIR_SAMPLE, LIST_LIMIT)),
    [rows, heroId],
  )
  const counters = useMemo(
    () => (heroId == null ? [] : worstMatchups(rows, heroId, MIN_PAIR_SAMPLE, LIST_LIMIT)),
    [rows, heroId],
  )

  return (
    <div className="border border-border" style={{ background: PANEL_BG }}>
      <div className="px-4 py-3 border-b border-border font-display uppercase text-[18px] tracking-[2px]">
        Synergies and Counters
      </div>
      <div className="p-4 space-y-4">
        {pairs.isPending && (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {pairs.isError && (
          <div className="text-[13px] text-muted">
            Hero pair stats are still being computed for the current patch. Check back shortly.
          </div>
        )}
        {!pairs.isPending && !pairs.isError && (
          <>
            <label className="block">
              <span className="block text-[12px] uppercase text-muted mb-1">Hero</span>
              <select
                value={heroId ?? ''}
                onChange={(e) => setHeroId(e.target.value === '' ? null : Number(e.target.value))}
                className="min-h-11 w-full max-w-xs border border-border px-2 py-1 text-[14px] font-dota text-foreground"
                style={{ background: 'rgba(8,10,12,0.7)' }}
              >
                <option value="">Select a hero...</option>
                {sortedHeroes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.localized_name}
                  </option>
                ))}
              </select>
            </label>

            {heroId != null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PairList title="Best with" views={partners} heroById={heroById} tone="radiant" />
                <PairList
                  title="Struggles against"
                  views={counters}
                  heroById={heroById}
                  tone="dire"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
