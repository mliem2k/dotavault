import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { BracketView } from '@/components/league/bracket_view'
import { buildSeries } from '@/components/league/series'
import { useTeamMap } from '@/components/league/use_team_map'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/league/$leagueId/results/$view')({
  component: ResultsViewPage,
})

function ResultsViewPage() {
  const { leagueId, view } = Route.useParams()
  const id = Number(leagueId)
  const activeView = view === 'bracket' ? 'bracket' : 'list'

  const matches = useQuery({
    queryKey: ['league_matches', id],
    queryFn: () => opendota.leagueMatches(id, 500, 0),
    staleTime: 5 * 60 * 1000,
  })
  const series = useMemo(() => buildSeries(matches.data ?? []), [matches.data])
  const relevantTeamIds = useMemo(() => series.flatMap((s) => [s.teamA, s.teamB]), [series])
  const teamMap = useTeamMap(relevantTeamIds)

  if (matches.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (activeView === 'bracket') {
    return <BracketView series={series} teamMap={teamMap} />
  }

  return (
    <div className="max-w-[720px]">
      {series.map((s, i) => {
        const teamA = teamMap.get(s.teamA ?? -1)
        const teamB = teamMap.get(s.teamB ?? -1)
        const aWon = s.scoreA > s.scoreB
        return (
          <div key={s.key} className="py-2.5" style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="truncate text-[15px]"
                    style={{ color: aWon ? '#8ec63f' : '#8a8474', fontFamily: 'var(--font-dota)', fontWeight: aWon ? 600 : 400 }}
                  >
                    {teamA?.name ?? (s.teamA ? `Team ${s.teamA}` : 'TBD')}
                  </span>
                  <span
                    className="shrink-0 px-2 py-0.5 text-[14px] font-bold tabular-nums"
                    style={{ color: '#dcd6c8', background: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-dota)' }}
                  >
                    {s.scoreA} : {s.scoreB}
                  </span>
                  <span
                    className="truncate text-[15px]"
                    style={{ color: !aWon ? '#8ec63f' : '#8a8474', fontFamily: 'var(--font-dota)', fontWeight: !aWon ? 600 : 400 }}
                  >
                    {teamB?.name ?? (s.teamB ? `Team ${s.teamB}` : 'TBD')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] uppercase tracking-wider" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                  Bo{s.bestOf}
                </div>
                <div className="text-[12px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                  {formatTimeAgo(s.lastStartTime)}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-0.5">
              {s.games.map((g) => {
                const radiantIsA = g.radiant_team_id === s.teamA
                const aWonGame = radiantIsA ? g.radiant_win : !g.radiant_win
                return (
                  <a
                    key={g.match_id}
                    href={`/match/${g.match_id}`}
                    className="px-2 py-1 text-[12px] tabular-nums hover:bg-white/[0.05]"
                    style={{ background: 'rgba(255,255,255,0.03)', color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                    title={`${formatDuration(g.duration)} · ${g.radiant_score ?? '?'}-${g.dire_score ?? '?'}`}
                  >
                    <span style={{ color: aWonGame ? '#8ec63f' : '#c73f2d' }}>{aWonGame ? 'W' : 'L'}</span>{' '}
                    {formatDuration(g.duration)}
                  </a>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
