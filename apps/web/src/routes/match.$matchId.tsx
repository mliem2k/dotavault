import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AdvantageGraph } from '@/components/match/advantage-graph'
import { DraftPanel } from '@/components/match/draft-panel'
import { Scoreboard } from '@/components/match/scoreboard'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/match/$matchId')({
  component: MatchPage,
})

function MatchPage() {
  const { matchId } = Route.useParams()

  const match = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => opendota.match(matchId),
  })

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  if (match.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!match.data) return <div className="text-sm text-muted">Match not found.</div>

  const m = match.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Match {m.match_id}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span>{formatTimeAgo(m.start_time)}</span>
            <span>·</span>
            <span>{formatDuration(m.duration)}</span>
          </div>
        </div>
        <Badge variant={m.radiant_win ? 'radiant' : 'dire'}>
          {m.radiant_win ? 'Radiant' : 'Dire'} Victory
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
        </CardHeader>
        {heroStats.data && <DraftPanel picksBans={m.picks_bans} heroStats={heroStats.data} />}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoreboard</CardTitle>
        </CardHeader>
        {heroStats.data && (
          <Scoreboard players={m.players} heroStats={heroStats.data} radiantWin={m.radiant_win} />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gold Advantage</CardTitle>
        </CardHeader>
        <AdvantageGraph radiantGoldAdv={m.radiant_gold_adv} radiantXpAdv={m.radiant_xp_adv} />
      </Card>
    </div>
  )
}
