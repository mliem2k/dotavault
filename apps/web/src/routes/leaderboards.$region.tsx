import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { countryFlagUrl, DIVISIONS, fetchLeaderboard, type Division } from '@/lib/leaderboard'
import { useLeaderboardData } from '@/lib/leaderboard_data_context'

export const Route = createFileRoute('/leaderboards/$region')({
  component: RegionPage,
})

const PAGE_SIZE = 50

const RANK_COLORS: Record<number, string> = {
  1: '#f2c94c',
  2: '#c8ccd1',
  3: '#c98a4a',
}

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RegionPage() {
  const { region } = Route.useParams()
  const division = (DIVISIONS.some((d) => d.id === region) ? region : 'americas') as Division
  const { search, setSearch, page, setPage, proFor } = useLeaderboardData()

  const query = useQuery({
    queryKey: ['leaderboard', division],
    queryFn: () => fetchLeaderboard(division),
    staleTime: 15 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    const rows = query.data?.leaderboard ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.team_tag ?? '').toLowerCase().includes(q),
    )
  }, [query.data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const shown = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="max-w-[860px] mx-auto" style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-wrap"
        style={{ borderBottom: '1px solid #24222a' }}
      >
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(() => 0)
          }}
          placeholder="Search player or team tag…"
          aria-label="Search player or team"
          className="text-[14px] px-3 py-1.5 flex-1 min-w-[200px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#c9a94a]"
          style={{
            background: '#14181b',
            color: '#dcd6c8',
            border: '1px solid #2c3236',
            fontFamily: 'var(--font-dota)',
          }}
        />
        {query.data && (
          <div className="text-[12px] text-right shrink-0" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
            Updated {fmtTime(query.data.time_posted)}
            <br />
            Next {fmtTime(query.data.next_scheduled_post_time)}
          </div>
        )}
      </div>

      {query.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !query.data ? (
        <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>
          This leaderboard is currently unavailable.
        </div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>
          No players match "{search}".
        </div>
      ) : (
        <div>
          {shown.map((r, i) => {
            const pro = proFor(r)
            const clickable = pro != null
            return (
            <div
              key={r.rank}
              className="relative flex w-full items-center gap-4 px-4 py-2.5 text-left"
              style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
            >
              {/* Stretched link (only when a pro profile was actually matched): the
                  whole row becomes a real, ctrl+click/middle-click openable link,
                  without nesting an <a> inside another interactive element around
                  the team-tag link below (invalid HTML). z-0 vs the team link's
                  z-10 keeps that independently clickable on top of it. */}
              {clickable && (
                <Link
                  to="/player/$accountId"
                  params={{ accountId: String(pro.account_id) }}
                  className="absolute inset-0 z-0 hover:bg-white/[0.04]"
                  title="Open pro profile"
                  aria-label={`Open pro profile for ${r.name}`}
                />
              )}
              <span
                className="w-10 shrink-0 text-right text-[16px] tabular-nums pointer-events-none"
                style={{ color: RANK_COLORS[r.rank] ?? '#8a8474', fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                {r.rank}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {r.team_tag ? (
                  r.team_id ? (
                    <a
                      href={`/team/${r.team_id}`}
                      className="relative z-10 shrink-0 text-[13px] px-1.5 py-0.5 hover:brightness-125"
                      style={{ background: '#24222a', color: '#c9a94a', fontFamily: 'var(--font-dota)' }}
                    >
                      {r.team_tag}
                    </a>
                  ) : (
                    <span
                      className="shrink-0 text-[13px] px-1.5 py-0.5"
                      style={{ background: '#24222a', color: '#c9a94a', fontFamily: 'var(--font-dota)' }}
                    >
                      {r.team_tag}
                    </span>
                  )
                ) : null}
                <span className="text-[14px] truncate" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                  {r.name}
                </span>
                {pro && (
                  <>
                    <span
                      className="shrink-0 px-1 text-[10px] uppercase"
                      style={{ color: '#c9a94a', border: '1px solid rgba(201,169,74,0.5)', letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
                    >
                      Pro
                    </span>
                    {pro.name !== r.name && (
                      <span className="hidden sm:inline-block truncate max-w-[140px] text-[13px]" style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}>
                        [{pro.name}]
                      </span>
                    )}
                    {pro.personaname && pro.personaname !== r.name && pro.personaname !== pro.name && (
                      <span className="hidden md:inline-block truncate max-w-[120px] text-[13px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                        {pro.personaname}
                      </span>
                    )}
                  </>
                )}
                {r.sponsor && (
                  <span className="hidden md:inline-block truncate max-w-[100px] text-[13px]" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
                    .{r.sponsor}
                  </span>
                )}
              </div>
              {r.country && (
                <img
                  src={countryFlagUrl(r.country)}
                  alt={r.country}
                  width={16}
                  height={11}
                  loading="lazy"
                  className="shrink-0 pointer-events-none"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div
          className="flex items-center justify-center gap-4 px-4 py-3"
          style={{ borderTop: '1px solid #24222a' }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="min-h-11 px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: '#cfd4d8', letterSpacing: '1px' }}
          >
            Prev
          </button>
          <span className="text-[13px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
            Page {clampedPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="min-h-11 px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: '#cfd4d8', letterSpacing: '1px' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
