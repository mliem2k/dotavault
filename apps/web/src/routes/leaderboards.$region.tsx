import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { countryFlagUrl, DIVISIONS, type Division, fetchLeaderboard } from '@/lib/leaderboard'
import { useLeaderboardData } from '@/lib/leaderboard_data_context'

export const Route = createFileRoute('/leaderboards/$region')({
  component: RegionPage,
})

const PAGE_SIZE = 50

// #c8ccd1 and #c98a4a (silver/bronze medal colors) are not in the Token
// Mapping Reference — left as-is per task instructions.
const RANK_COLORS: Record<number, string> = {
  1: 'var(--color-gold)',
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
    <div
      className="max-w-[860px] mx-auto border border-border"
      style={{ background: 'rgba(12,11,14,0.72)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap border-b border-border">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(() => 0)
          }}
          placeholder="Search player or team tag…"
          aria-label="Search player or team"
          className="text-[14px] px-3 py-1.5 flex-1 min-w-[200px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold bg-slate-bg text-foreground border border-slate-card font-dota"
        />
        {query.data && (
          <div className="text-[12px] text-right shrink-0 text-muted font-dota">
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
        <div className="py-16 text-center text-[14px] text-muted">
          This leaderboard is currently unavailable.
        </div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-muted">No players match "{search}".</div>
      ) : (
        <div>
          {shown.map((r, i) => {
            const pro = proFor(r)
            const clickable = pro != null
            return (
              <div
                key={r.rank}
                className={`relative flex w-full items-center gap-4 px-4 py-2.5 text-left ${i === 0 ? '' : 'border-t border-border'}`}
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
                  className="w-10 shrink-0 text-right text-[16px] tabular-nums pointer-events-none font-display"
                  style={{ color: RANK_COLORS[r.rank] ?? 'var(--color-muted)', fontWeight: 600 }}
                >
                  {r.rank}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {r.team_tag ? (
                    r.team_id ? (
                      <a
                        href={`/team/${r.team_id}`}
                        className="relative z-10 shrink-0 text-[13px] px-1.5 py-0.5 hover:brightness-125 bg-border text-gold font-dota"
                      >
                        {r.team_tag}
                      </a>
                    ) : (
                      <span className="shrink-0 text-[13px] px-1.5 py-0.5 bg-border text-gold font-dota">
                        {r.team_tag}
                      </span>
                    )
                  ) : null}
                  <span className="text-[14px] truncate text-foreground font-dota">{r.name}</span>
                  {pro && (
                    <>
                      <span
                        className="shrink-0 px-1 text-[10px] uppercase text-gold font-dota"
                        style={{ border: '1px solid rgba(201,169,74,0.5)', letterSpacing: '1px' }}
                      >
                        Pro
                      </span>
                      {pro.name !== r.name && (
                        <span className="hidden sm:inline-block truncate max-w-[140px] text-[13px] text-gold font-dota">
                          [{pro.name}]
                        </span>
                      )}
                      {pro.personaname &&
                        pro.personaname !== r.name &&
                        pro.personaname !== pro.name && (
                          <span className="hidden md:inline-block truncate max-w-[120px] text-[13px] text-muted font-dota">
                            {pro.personaname}
                          </span>
                        )}
                    </>
                  )}
                  {r.sponsor && (
                    // #77715f is not in the Token Mapping Reference (close to but distinct
                    // from #8a8474/#5a5648 text-muted) — left as-is per task instructions.
                    <span
                      className="hidden md:inline-block truncate max-w-[100px] text-[13px] font-dota"
                      style={{ color: '#77715f' }}
                    >
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
        <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="min-h-11 px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40 border border-slate-card text-slate-foreground"
            // #1a2024 is not in the Token Mapping Reference (close to but distinct
            // from #14181b bg-slate-bg) — left as-is per task instructions.
            style={{ background: '#1a2024', letterSpacing: '1px' }}
          >
            Prev
          </button>
          <span className="text-[13px] tabular-nums text-muted font-dota">
            Page {clampedPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="min-h-11 px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40 border border-slate-card text-slate-foreground"
            style={{ background: '#1a2024', letterSpacing: '1px' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
