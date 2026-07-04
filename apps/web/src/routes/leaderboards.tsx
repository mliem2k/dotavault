import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { countryFlagUrl, DIVISIONS, fetchLeaderboard, type Division } from '@/lib/leaderboard'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/leaderboards')({
  component: LeaderboardsPage,
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

function LeaderboardsPage() {
  usePageTitle('Leaderboards')
  const navigate = useNavigate()
  const [division, setDivision] = useState<Division>('americas')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [resolvingRank, setResolvingRank] = useState<number | null>(null)
  const [notFoundRank, setNotFoundRank] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['leaderboard', division],
    queryFn: () => fetchLeaderboard(division),
    staleTime: 15 * 60 * 1000,
  })

  // Shared cache with the player page's pro-roster lookup. Leaderboard rows
  // carry only a display name, so match it against each pro's persona name
  // both to show their real/pro name alongside it and, on click, to jump
  // straight to their account id without touching OpenDota's slow search.
  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 60 * 60 * 1000,
  })
  const proByPersona = useMemo(() => {
    const map = new Map<string, { name: string; account_id: number }>()
    for (const p of proPlayers.data ?? []) {
      if (p.is_pro && p.name && p.personaname) {
        map.set(p.personaname.toLowerCase(), { name: p.name, account_id: p.account_id })
      }
    }
    return map
  }, [proPlayers.data])

  // Valve's public leaderboard exposes only a display name, never an account
  // id. A known pro (matched via the roster above) resolves instantly with
  // no network call; anything else falls back to OpenDota's player search,
  // which can be slow, so only pay that cost when we actually have to. The
  // top-ranked search hit is trusted as-is: these are distinctive top-5000
  // names, so an exact index match is effectively always the right account.
  async function openProfile(name: string, rank: number) {
    if (name.length >= 3) {
      const pro = proByPersona.get(name.toLowerCase())
      if (pro) {
        navigate({ to: '/player/$accountId', params: { accountId: String(pro.account_id) } })
        return
      }
    }

    setNotFoundRank(null)
    setResolvingRank(rank)
    try {
      const results = await opendota.search(name)
      // Only an exact (case-insensitive) persona-name match is trustworthy —
      // falling back to the top fuzzy result risks landing on a completely
      // unrelated player who merely searched similarly.
      const match = results.find((r) => r.personaname.toLowerCase() === name.toLowerCase())
      if (match) {
        navigate({ to: '/player/$accountId', params: { accountId: String(match.account_id) } })
      } else {
        setNotFoundRank(rank)
      }
    } catch {
      setNotFoundRank(rank)
    } finally {
      setResolvingRank(null)
    }
  }

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

  function selectDivision(d: Division) {
    setDivision(d)
    setSearch('')
    setPage(0)
  }

  return (
    <div className="space-y-6 py-4">
      <div className="text-center mb-2">
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '2px' }}
        >
          World Leaderboards
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em]"
          style={{
            color: '#fff',
            fontFamily: 'var(--font-dota)',
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)',
          }}
        >
          Top 5,000 players by solo ranked MMR, per region
        </p>
      </div>

      {/* Region tabs */}
      <div className="flex items-center justify-center gap-2">
        {DIVISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => selectDivision(d.id)}
            className="px-5 py-2 text-[14px] uppercase cursor-pointer transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '1px',
              fontWeight: 600,
              background: division === d.id ? 'rgba(201,169,74,0.15)' : 'transparent',
              color: division === d.id ? '#c9a94a' : '#8a8474',
              border: `1px solid ${division === d.id ? '#c9a94a' : '#24222a'}`,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

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
              setPage(0)
            }}
            placeholder="Search player or team tag…"
            className="text-[14px] px-3 py-1.5 outline-none flex-1 min-w-[200px]"
            style={{
              background: '#14181b',
              color: '#dcd6c8',
              border: '1px solid #2c3236',
              fontFamily: 'var(--font-dota)',
            }}
          />
          {query.data && (
            <div className="text-[12px] text-right shrink-0" style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}>
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
            {shown.map((r, i) => (
              <button
                key={r.rank}
                type="button"
                onClick={() => openProfile(r.name, r.rank)}
                className="flex w-full items-center gap-4 px-4 py-2.5 text-left cursor-pointer hover:bg-white/[0.04]"
                style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
              >
                <span
                  className="w-10 shrink-0 text-right text-[16px] tabular-nums"
                  style={{ color: RANK_COLORS[r.rank] ?? '#4a4436', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                >
                  {r.rank}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {r.team_tag ? (
                    r.team_id ? (
                      <a
                        href={`/team/${r.team_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-[13px] px-1.5 py-0.5 hover:brightness-125"
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
                  <span className="text-[16px] truncate" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                    {r.name}
                  </span>
                  {(() => {
                    // Short/generic names (".", "1", "))") collide across
                    // unrelated players too often for a persona-name match
                    // to be trustworthy — require a few real characters.
                    if (r.name.length < 3) return null
                    const pro = proByPersona.get(r.name.toLowerCase())
                    return (
                      pro &&
                      pro.name !== r.name && (
                        <span className="text-[13px] shrink-0" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                          [{pro.name}]
                        </span>
                      )
                    )
                  })()}
                  {r.sponsor && (
                    <span className="text-[13px] shrink-0" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
                      .{r.sponsor}
                    </span>
                  )}
                  {resolvingRank === r.rank && <Spinner className="h-3.5 w-3.5 shrink-0" />}
                  {notFoundRank === r.rank && (
                    <span className="text-[12px] shrink-0" style={{ color: '#8a5a5a', fontFamily: 'var(--font-dota)' }}>
                      No profile found
                    </span>
                  )}
                </div>
                {r.country && (
                  <img
                    src={countryFlagUrl(r.country)}
                    alt={r.country}
                    className="shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                )}
              </button>
            ))}
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
              className="px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40"
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
              className="px-4 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-40"
              style={{ background: '#1a2024', border: '1px solid #2c3236', color: '#cfd4d8', letterSpacing: '1px' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
