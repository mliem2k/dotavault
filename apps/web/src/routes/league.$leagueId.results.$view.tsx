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
    <>
      {series.map((s, i) => {
        const teamA = teamMap.get(s.teamA ?? -1)
        const teamB = teamMap.get(s.teamB ?? -1)
        const aWon = s.scoreA > s.scoreB
        return (
          <div key={s.key} className={`py-2.5 ${i === 0 ? '' : 'border-t border-border'}`}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`truncate text-[15px] font-dota ${aWon ? 'text-radiant' : 'text-muted'}`}
                    style={{ fontWeight: aWon ? 600 : 400 }}
                  >
                    {teamA?.name ?? (s.teamA ? `Team ${s.teamA}` : 'TBD')}
                  </span>
                  <span
                    className="shrink-0 px-2 py-0.5 text-[14px] font-bold tabular-nums text-foreground font-dota"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    {s.scoreA} : {s.scoreB}
                  </span>
                  <span
                    className={`truncate text-[15px] font-dota ${!aWon ? 'text-radiant' : 'text-muted'}`}
                    style={{ fontWeight: !aWon ? 600 : 400 }}
                  >
                    {teamB?.name ?? (s.teamB ? `Team ${s.teamB}` : 'TBD')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] uppercase tracking-wider text-muted font-dota">
                  Bo{s.bestOf}
                </div>
                <div className="text-[12px] tabular-nums text-muted font-dota">
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
                    className="px-2 py-1 text-[12px] tabular-nums hover:bg-white/[0.05] text-muted font-dota"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    title={`${formatDuration(g.duration)} · ${g.radiant_score ?? '?'}-${g.dire_score ?? '?'}`}
                  >
                    {/* #c73f2d is not in the Token Mapping Reference (close to but distinct from
                        text-dire's #d14a38/#c94a38) — left as raw inline style per established precedent. */}
                    <span
                      className={aWonGame ? 'text-radiant' : undefined}
                      style={!aWonGame ? { color: '#c73f2d' } : undefined}
                    >
                      {aWonGame ? 'W' : 'L'}
                    </span>{' '}
                    {formatDuration(g.duration)}
                  </a>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
