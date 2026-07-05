import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'
import { formatDuration, formatTimeAgo, heroIconUrl } from '@/lib/utils'

export const Route = createFileRoute('/league/$leagueId')({
  component: LeaguePage,
})

/* League report: draft stats, team standings, and the match list scoped to
   one specific tournament, inspired by D2-LRG's per-league reports (which
   is a deprecated, self-hosted PHP/MySQL tool; this is our own take on the
   same idea, built on OpenDota's SQL Explorer, same pattern as the Pro Only
   match filter). */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase"
        style={{ color: '#c8c2b4', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '3px', borderBottom: '1px solid #24222a' }}
      >
        {title}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function DraftPanel({
  leagueId,
  heroMap,
}: {
  leagueId: number
  heroMap: Map<number, { localized_name: string; name: string }>
}) {
  const heroStats = useQuery({
    queryKey: ['league_hero_stats', leagueId],
    queryFn: () => opendota.leagueHeroStats(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const banStats = useQuery({
    queryKey: ['league_ban_stats', leagueId],
    queryFn: () => opendota.leagueBanStats(leagueId),
    staleTime: 10 * 60 * 1000,
  })

  const banByHero = useMemo(() => new Map((banStats.data ?? []).map((b) => [b.hero_id, b.bans])), [banStats.data])
  const topPicks = [...(heroStats.data ?? [])].sort((a, b) => b.picks - a.picks).slice(0, 15)
  const maxPick = Math.max(1, ...topPicks.map((h) => h.picks))

  return (
    <Panel title="Draft">
      {(heroStats.isPending || banStats.isPending) && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {topPicks.length === 0 && !heroStats.isPending && (
        <div className="py-8 text-center text-[13px]" style={{ color: '#8a8474' }}>
          No draft data for this league yet.
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-dota)' }}>
        <thead>
          <tr className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#8a8474' }}>
            <th className="pb-2 text-left">Hero</th>
            <th className="pb-2 px-2 text-right">Picks</th>
            <th className="pb-2 px-2 text-right">Win Rate</th>
            <th className="pb-2 px-2 text-right">Bans</th>
          </tr>
        </thead>
        <tbody>
          {topPicks.map((h) => {
            const hero = heroMap.get(h.hero_id)
            const wr = h.picks > 0 ? (h.wins / h.picks) * 100 : 0
            const bans = banByHero.get(h.hero_id) ?? 0
            return (
              <tr key={h.hero_id} style={{ borderTop: '1px solid #1c1810' }}>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    {hero && <img src={heroIconUrl(hero.name)} alt="" className="h-6 w-6 rounded" />}
                    <span className="truncate text-[14px]" style={{ color: '#dcd6c8' }}>
                      {hero?.localized_name ?? `Hero ${h.hero_id}`}
                    </span>
                  </div>
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#dcd6c8' }}>
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-[6px]" style={{ width: 60, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${(h.picks / maxPick) * 100}%`, height: '100%', background: '#c9a94a' }} />
                    </div>
                    {h.picks}
                  </div>
                </td>
                <td
                  className="px-2 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: wr >= 52 ? '#8ec63f' : wr < 48 ? '#d14a38' : '#dcd6c8' }}
                >
                  {wr.toFixed(1)}%
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#d14a38' }}>
                  {bans || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

function StandingsPanel({
  leagueId,
  teamMap,
}: {
  leagueId: number
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const standings = useQuery({
    queryKey: ['league_standings', leagueId],
    queryFn: () => opendota.leagueTeamStandings(leagueId),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <Panel title="Team Standings">
      {standings.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {standings.data?.length === 0 && (
        <div className="py-8 text-center text-[13px]" style={{ color: '#8a8474' }}>
          No team-attributed matches in this league.
        </div>
      )}
      {(standings.data ?? []).map((s, i) => {
        const team = teamMap.get(s.team_id)
        const games = s.wins + s.losses
        const wr = games > 0 ? (s.wins / games) * 100 : 0
        return (
          <a
            key={s.team_id}
            href={`/team/${s.team_id}`}
            className="flex items-center gap-3 py-1.5 hover:bg-white/[0.03]"
            style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
          >
            <span className="w-5 shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}>
              {i + 1}
            </span>
            {team?.logo_url ? (
              <img
                src={team.logo_url}
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
              {team?.name ?? `Team ${s.team_id}`}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
              {s.wins}W {s.losses}L
              <span className="ml-2" style={{ color: wr >= 55 ? '#8ec63f' : wr < 45 ? '#d14a38' : '#8a8474' }}>
                {wr.toFixed(0)}%
              </span>
            </span>
          </a>
        )
      })}
    </Panel>
  )
}

function MatchesPanel({
  leagueId,
  teamMap,
}: {
  leagueId: number
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const matches = useQuery({
    queryKey: ['league_matches', leagueId],
    queryFn: () => opendota.leagueMatches(leagueId, 50, 0),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Panel title="Matches">
      {matches.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {(matches.data ?? []).map((m, i) => {
        const rad = teamMap.get(m.radiant_team_id ?? -1)
        const dire = teamMap.get(m.dire_team_id ?? -1)
        return (
          <a
            key={m.match_id}
            href={`/match/${m.match_id}`}
            className="flex items-center gap-3 py-2 hover:bg-white/[0.03]"
            style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="truncate text-[15px]"
                  style={{ color: m.radiant_win ? '#8ec63f' : '#a09a8c', fontFamily: 'var(--font-dota)', fontWeight: m.radiant_win ? 600 : 400 }}
                >
                  {rad?.name ?? (m.radiant_team_id ? `Team ${m.radiant_team_id}` : 'Radiant')}
                </span>
                <span className="shrink-0 px-1.5 text-[13px] tabular-nums" style={{ color: '#dcd6c8', background: 'rgba(255,255,255,0.05)', fontFamily: 'var(--font-dota)' }}>
                  {m.radiant_score ?? '?'} : {m.dire_score ?? '?'}
                </span>
                <span
                  className="truncate text-[15px]"
                  style={{ color: !m.radiant_win ? '#8ec63f' : '#a09a8c', fontFamily: 'var(--font-dota)', fontWeight: !m.radiant_win ? 600 : 400 }}
                >
                  {dire?.name ?? (m.dire_team_id ? `Team ${m.dire_team_id}` : 'Dire')}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                {formatTimeAgo(m.start_time)}
              </div>
              <div className="mt-0.5 text-[13px] tabular-nums" style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}>
                {formatDuration(m.duration)}
              </div>
            </div>
          </a>
        )
      })}
    </Panel>
  )
}

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
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 60 * 60 * 1000,
  })
  const teams = useQuery({
    queryKey: ['teams_list'],
    queryFn: () => opendota.teamsList(),
    staleTime: 30 * 60 * 1000,
  })

  const league = leagues.data?.find((l) => l.leagueid === id)
  usePageTitle(league?.name ? `League · ${league.name}` : 'League')

  const heroMap = useMemo(() => new Map((heroStats.data ?? []).map((h) => [h.id, h])), [heroStats.data])
  const teamMap = useMemo(() => new Map((teams.data ?? []).map((t) => [t.team_id, t])), [teams.data])

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>Invalid league id.</div>
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1
          className="text-[36px] leading-tight font-bold uppercase"
          style={{ color: '#e8e2d4', fontFamily: 'var(--font-display)', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          {league?.name ?? (leagues.isPending ? 'Loading...' : `League ${id}`)}
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.15em]"
          style={{ color: '#fff', fontFamily: 'var(--font-dota)', textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          {summary.data
            ? `${summary.data.total_matches.toLocaleString()} matches${
                summary.data.first_match
                  ? ` · ${formatTimeAgo(summary.data.first_match)} to ${formatTimeAgo(summary.data.last_match ?? summary.data.first_match)}`
                  : ''
              }`
            : 'Loading match history...'}
        </p>
      </div>

      {summary.data && summary.data.total_matches === 0 ? (
        <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>
          OpenDota has no recorded matches for this league.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <DraftPanel leagueId={id} heroMap={heroMap} />
          </div>
          <StandingsPanel leagueId={id} teamMap={teamMap} />
          <MatchesPanel leagueId={id} teamMap={teamMap} />
        </div>
      )}
    </div>
  )
}
