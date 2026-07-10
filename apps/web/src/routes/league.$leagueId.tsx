import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useMemo } from 'react'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'
import { formatDate, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/league/$leagueId')({
  component: LeaguePage,
})

// OpenDota's "excluded" tier just means "not counted toward pro stats"
// (true of most qualifier brackets), not "not a real event", so relabel it
// for the qualifiers list.
const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  professional: 'Professional',
  amateur: 'Amateur',
  minor: 'Minor',
  excluded: 'Qualifier',
}

/* League report: draft stats, team standings, and the match list scoped to
   one specific tournament, inspired by D2-LRG's per-league reports (which
   is a deprecated, self-hosted PHP/MySQL tool; this is our own take on the
   same idea, built on OpenDota's SQL Explorer, same pattern as the Pro Only
   match filter). */

function LeaguePage() {
  const { leagueId } = Route.useParams()
  const id = Number(leagueId)

  const summary = useQuery({
    queryKey: ['league_summary', id],
    queryFn: () => opendota.leagueSummary(id),
    staleTime: 30 * 60 * 1000,
    enabled: Number.isInteger(id) && id > 0,
  })
  const leagues = useQuery({
    queryKey: ['leagues_list'],
    queryFn: () => opendota.leaguesList(),
    staleTime: 60 * 60 * 1000,
  })

  const league = leagues.data?.find((l) => l.leagueid === id)
  usePageTitle(league?.name ? `League · ${league.name}` : 'League')

  // The main event's own leagueid often has no matches yet (it hasn't been
  // played), while its qualifiers already have real data under sibling
  // leagueids. OpenDota names those with the same prefix, e.g. "The
  // International 2026 - Regional Qualifier Europe", so surface them
  // instead of leaving the page blank.
  const relatedLeagues = useMemo(() => {
    if (!league?.name) return []
    const prefix = `${league.name} - `
    return (leagues.data ?? [])
      .filter((l) => l.leagueid !== id && l.name?.startsWith(prefix))
      .map((l) => ({ ...l, subName: l.name.slice(prefix.length) }))
      .sort((a, b) => a.subName.localeCompare(b.subName))
  }, [leagues.data, league?.name, id])

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="py-16 text-center text-[14px] text-muted">Invalid league id.</div>
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1
          className="leading-tight font-bold uppercase text-foreground font-display"
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.75rem)',
            letterSpacing: '1px',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          {league?.name ?? (leagues.isPending ? 'Loading...' : `League ${id}`)}
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.15em] text-white font-dota"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          {summary.data
            ? `${summary.data.total_matches.toLocaleString()} matches${
                summary.data.first_match
                  ? ` · ${formatDate(summary.data.first_match)} (${formatTimeAgo(summary.data.first_match)}) to ${formatDate(summary.data.last_match ?? summary.data.first_match)} (${formatTimeAgo(summary.data.last_match ?? summary.data.first_match)})`
                  : ''
              }`
            : 'Loading match history...'}
        </p>
      </div>

      {summary.data && summary.data.total_matches === 0 ? (
        <div>
          <div className="py-8 text-center text-[14px] text-muted">
            {relatedLeagues.length > 0
              ? "This event hasn't been played yet, no matches recorded."
              : 'OpenDota has no recorded matches for this league.'}
          </div>
          {relatedLeagues.length > 0 && (
            <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
              <div className="px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-gold font-dota border-b border-border">
                Qualifiers and related events
              </div>
              {relatedLeagues.map((l, i) => (
                <a
                  key={l.leagueid}
                  href={`/league/${l.leagueid}`}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
                >
                  <span className="flex-1 truncate text-[15px] text-foreground font-dota">
                    {l.subName}
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
          )}
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  )
}
