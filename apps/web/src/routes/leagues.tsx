import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { applySort, useSort } from '@/lib/sortable'
import { usePageTitle } from '@/lib/title'

type LeaguesSearch = { q?: string; tier?: string; sort?: SortKey; dir?: 'asc' | 'desc' }

export const Route = createFileRoute('/leagues')({
  component: LeaguesPage,
  validateSearch: (search: Record<string, unknown>): LeaguesSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    tier: typeof search.tier === 'string' && search.tier ? search.tier : undefined,
    sort: search.sort === 'name' || search.sort === 'tier' ? search.sort : undefined,
    dir: search.dir === 'asc' || search.dir === 'desc' ? search.dir : undefined,
  }),
})

/* League browser: search OpenDota's full league directory and jump into a
   league's own scoped report (draft stats, standings, matches).

   OpenDota's /leagues endpoint only ever returns leagueid/name/tier/ticket/
   banner (checked against a full live pull of all ~10k leagues), no start
   date, end date, or prize pool for any league, so those can't be sortable
   columns here; there's nothing to sort. Name and Tier are the only real,
   sortable fields. */

const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  professional: 'Professional',
  amateur: 'Amateur',
  minor: 'Minor',
}
const TIER_ORDER: Record<string, number> = { premium: 0, professional: 1, minor: 2, amateur: 3 }

type SortKey = 'name' | 'tier'

function LeaguesPage() {
  usePageTitle('Leagues')
  const urlSearch = Route.useSearch()
  const navigate = Route.useNavigate()

  const [search, setSearch] = useState(urlSearch.q ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch.q ?? '')
  const [tier, setTier] = useState<string>(urlSearch.tier ?? 'all')
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>(urlSearch.sort ?? 'tier', urlSearch.dir ?? 'asc')

  // Debounce so every keystroke doesn't re-filter/re-sort the full leagues
  // list (up to 300 rows deep); only the settled value feeds the memo below.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(id)
  }, [search])

  // Mirror filters/sort into the URL (replace, not push, so the back button
  // doesn't step through every keystroke) so a filtered/sorted view is
  // shareable and survives a refresh.
  useEffect(() => {
    navigate({
      search: {
        q: debouncedSearch || undefined,
        tier: tier !== 'all' ? tier : undefined,
        sort: sortKey !== 'tier' ? sortKey : undefined,
        dir: !(sortKey === 'tier' && sortDir === 'asc') ? sortDir : undefined,
      },
      replace: true,
    })
  }, [debouncedSearch, tier, sortKey, sortDir, navigate])

  const leagues = useQuery({
    queryKey: ['leagues_list'],
    queryFn: () => opendota.leaguesList(),
    staleTime: 60 * 60 * 1000,
  })

  const rows = useMemo(() => {
    let list = leagues.data ?? []
    if (tier !== 'all') list = list.filter((l) => (l.tier ?? '') === tier)
    const q = debouncedSearch.trim().toLowerCase()
    if (q) list = list.filter((l) => l.name?.toLowerCase().includes(q))
    const sorted = applySort(list, sortDir, (a, b) => {
      if (sortKey === 'name') return (a.name ?? '').localeCompare(b.name ?? '')
      const ta = TIER_ORDER[a.tier ?? ''] ?? 9
      const tb = TIER_ORDER[b.tier ?? ''] ?? 9
      // Tier ties (most of the list) fall back to most-recently-created
      // first, same as the old fixed default, rather than an arbitrary order.
      return ta !== tb ? ta - tb : b.leagueid - a.leagueid
    })
    return sorted.slice(0, 300)
  }, [leagues.data, debouncedSearch, tier, sortKey, sortDir])

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h1
          className="leading-none font-bold uppercase text-foreground font-display"
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.75rem)',
            letterSpacing: '2px',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          Leagues
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em] text-white font-dota"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          Search any tournament for its own draft stats, standings, and matches
        </p>
      </div>

      <div className="max-w-[720px] mx-auto flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search league name..."
          aria-label="Search league name"
          className="w-full px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-[280px] border border-border text-foreground font-dota"
          style={{ background: 'rgba(12,11,14,0.72)' }}
        />
        <div className="flex flex-wrap items-center border border-border">
          {['all', 'premium', 'professional', 'minor', 'amateur'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`px-3 py-2 text-[12px] uppercase cursor-pointer text-white font-dota ${tier === t ? 'bg-border' : 'bg-transparent'}`}
              style={{
                textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)',
                letterSpacing: '1px',
              }}
            >
              {t === 'all' ? 'All Tiers' : (TIER_LABELS[t] ?? t)}
            </button>
          ))}
        </div>
        {leagues.data && (
          <span
            className="text-[12px] sm:ml-auto text-white font-dota"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
          >
            {rows.length} of {leagues.data.length.toLocaleString()} leagues
          </span>
        )}
      </div>

      <div className="max-w-[720px] mx-auto border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
        {leagues.data && rows.length > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2 text-[12px] uppercase text-muted font-dota border-b border-border"
            style={{ letterSpacing: '1px' }}
          >
            <SortHeader label="Name" sortKey="name" active={sortKey === 'name'} dir={sortDir} onClick={onSort} className="flex-1" />
            <SortHeader label="Tier" sortKey="tier" active={sortKey === 'tier'} dir={sortDir} onClick={onSort} className="shrink-0" />
          </div>
        )}
        {leagues.isPending && (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {!leagues.isPending && rows.length === 0 && (
          <div className="py-16 text-center text-[14px] text-muted">
            No leagues match "{debouncedSearch}".
          </div>
        )}
        {rows.map((l, i) => (
          <a
            key={l.leagueid}
            href={`/league/${l.leagueid}`}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
          >
            <span className="flex-1 truncate text-[15px] text-foreground font-dota">
              {l.name || `League ${l.leagueid}`}
            </span>
            {l.tier && (
              <span
                className="shrink-0 px-2 py-0.5 text-[12px] uppercase text-gold font-dota"
                style={{ background: 'rgba(255,255,255,0.05)', letterSpacing: '1px' }}
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
