import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { DIVISIONS, type LeaderboardEntry } from '@/lib/leaderboard'
import { LeaderboardDataContext, type ProRef } from '@/lib/leaderboard_data_context'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/leaderboards')({
  component: LeaderboardsPage,
})

function LeaderboardsPage() {
  usePageTitle('Leaderboards')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Shared cache with the player page's pro-roster lookup. Leaderboard rows
  // carry only a display name, so match it against each pro's persona name
  // both to show their real/pro name alongside it and, on click, to jump
  // straight to their account id without touching OpenDota's slow search.
  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 60 * 60 * 1000,
  })
  const proIndex = useMemo(() => {
    const byProName = new Map<string, ProRef[]>()
    const byPersona = new Map<string, ProRef[]>()
    for (const p of proPlayers.data ?? []) {
      if (!p.is_pro || !p.name) continue
      const ref: ProRef = {
        name: p.name,
        personaname: p.personaname ?? null,
        account_id: p.account_id,
        team_id: p.team_id ?? null,
      }
      const nk = p.name.toLowerCase()
      byProName.set(nk, [...(byProName.get(nk) ?? []), ref])
      if (p.personaname) {
        const pk = p.personaname.toLowerCase()
        byPersona.set(pk, [...(byPersona.get(pk) ?? []), ref])
      }
    }
    return { byProName, byPersona }
  }, [proPlayers.data])

  // Valve's public leaderboard exposes only a display name, never an
  // account id. Registered pros usually appear under their official pro
  // nickname (with a team tag), so match that first, verified by team id
  // when both sides have one; persona names cover the rest. Everyone else
  // is intentionally NOT clickable: the only generic fallback would be
  // OpenDota's slow name search, and a bare name match for a non-pro can
  // land on an unrelated impostor account.
  function proFor(r: LeaderboardEntry): ProRef | undefined {
    const key = r.name.toLowerCase()
    const nameCands = proIndex.byProName.get(key) ?? []
    const personaCands = proIndex.byPersona.get(key) ?? []

    if (r.team_id) {
      const teamVerified =
        nameCands.find((c) => c.team_id === r.team_id) ??
        personaCands.find((c) => c.team_id === r.team_id)
      if (teamVerified) return teamVerified
    }
    // Without team verification require a few real characters: short or
    // symbol-only names collide across unrelated players too often.
    if (r.name.length < 3) return undefined
    if (nameCands.length === 1) return nameCands[0]
    if (personaCands.length === 1) return personaCands[0]
    return undefined
  }

  return (
    <div className="space-y-6 py-4">
      <div className="text-center mb-2">
        <h1
          className="text-[44px] leading-none font-bold uppercase font-display text-foreground"
          style={{ letterSpacing: '2px' }}
        >
          World Leaderboards
        </h1>
        <p className="mt-2 text-[13px] uppercase tracking-[0.2em] font-dota text-foreground">
          Top 5,000 players by solo ranked MMR, per region
        </p>
      </div>

      {/* Region tabs */}
      <div className="flex items-center justify-center gap-2 py-1" role="tablist">
        {DIVISIONS.map((d) => (
          <Link
            key={d.id}
            to="/leaderboards/$region"
            params={{ region: d.id }}
            onClick={() => {
              setSearch('')
              setPage(0)
            }}
            role="tab"
            className="min-h-11 inline-flex items-center justify-center px-5 py-2 text-[14px] uppercase cursor-pointer transition-colors font-display"
            activeOptions={{ exact: true }}
            style={{
              letterSpacing: '1px',
              fontWeight: 600,
              background: 'rgba(12,11,14,0.72)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
            }}
            activeProps={{
              'aria-current': 'page',
              style: {
                background: 'rgba(201,169,74,0.18)',
                color: 'var(--color-gold)',
                border: '1px solid var(--color-gold)',
              },
            }}
          >
            {d.label}
          </Link>
        ))}
      </div>

      <LeaderboardDataContext.Provider value={{ search, setSearch, page, setPage, proFor }}>
        <Outlet />
      </LeaderboardDataContext.Provider>
    </div>
  )
}
