import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/leagues')({
  component: LeaguesPage,
})

/* League browser: search OpenDota's full league directory and jump into a
   league's own scoped report (draft stats, standings, matches). */

const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  professional: 'Professional',
  amateur: 'Amateur',
  minor: 'Minor',
}
const TIER_ORDER: Record<string, number> = { premium: 0, professional: 1, minor: 2, amateur: 3 }

function LeaguesPage() {
  usePageTitle('Leagues')
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState<string>('all')

  const leagues = useQuery({
    queryKey: ['leagues_list'],
    queryFn: () => opendota.leaguesList(),
    staleTime: 60 * 60 * 1000,
  })

  const rows = useMemo(() => {
    let list = leagues.data ?? []
    if (tier !== 'all') list = list.filter((l) => (l.tier ?? '') === tier)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((l) => l.name?.toLowerCase().includes(q))
    return [...list]
      .sort((a, b) => {
        const ta = TIER_ORDER[a.tier ?? ''] ?? 9
        const tb = TIER_ORDER[b.tier ?? ''] ?? 9
        if (ta !== tb) return ta - tb
        return b.leagueid - a.leagueid
      })
      .slice(0, 300)
  }, [leagues.data, search, tier])

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ color: '#e8e2d4', fontFamily: 'var(--font-display)', letterSpacing: '2px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          Leagues
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em]"
          style={{ color: '#fff', fontFamily: 'var(--font-dota)', textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          Search any tournament for its own draft stats, standings, and matches
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search league name..."
          className="px-3 py-2 text-[14px] outline-none"
          style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a', color: '#dcd6c8', fontFamily: 'var(--font-dota)', width: 280 }}
        />
        <div className="flex items-center" style={{ border: '1px solid #24222a' }}>
          {['all', 'premium', 'professional', 'minor', 'amateur'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className="px-3 py-2 text-[12px] uppercase cursor-pointer"
              style={{
                background: tier === t ? '#24222a' : 'transparent',
                color: tier === t ? '#dcd6c8' : '#8a8474',
                letterSpacing: '1px',
                fontFamily: 'var(--font-dota)',
              }}
            >
              {t === 'all' ? 'All Tiers' : (TIER_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
        {leagues.data && (
          <span className="ml-auto text-[12px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
            {rows.length} of {leagues.data.length.toLocaleString()} leagues
          </span>
        )}
      </div>

      <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
        {leagues.isPending && (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {!leagues.isPending && rows.length === 0 && (
          <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>
            No leagues match "{search}".
          </div>
        )}
        {rows.map((l, i) => (
          <a
            key={l.leagueid}
            href={`/league/${l.leagueid}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
            style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
          >
            <span className="flex-1 truncate text-[15px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
              {l.name || `League ${l.leagueid}`}
            </span>
            {l.tier && (
              <span
                className="shrink-0 px-2 py-0.5 text-[12px] uppercase"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#c9a94a', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
              >
                {TIER_LABELS[l.tier] ?? l.tier}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
