import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HeroStatsTable } from '@/components/player/hero-stats-table'
import { MatchHistory } from '@/components/player/match-history'
import { PlayerHeader } from '@/components/player/player-header'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/eden'

export const Route = createFileRoute('/player/$accountId')({
  component: PlayerPage,
})

function PlayerPage() {
  const { accountId } = Route.useParams()

  const player = useQuery({
    queryKey: ['player', accountId],
    queryFn: async () => {
      const { data } = await api.players({ id: accountId }).get()
      return data
    },
  })

  const matches = useQuery({
    queryKey: ['player-matches', accountId],
    queryFn: async () => {
      const { data } = await api.players({ id: accountId }).matches.get({ query: { limit: '50' } })
      return data
    },
  })

  const playerHeroes = useQuery({
    queryKey: ['player-heroes', accountId],
    queryFn: async () => {
      const { data } = await api.players({ id: accountId }).heroes.get()
      return data
    },
  })

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: async () => {
      const { data } = await api.heroes.get()
      return data
    },
  })

  if (player.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!player.data) return <div className="text-sm text-muted">Player not found.</div>

  return (
    <div className="space-y-6">
      <Card>
        <PlayerHeader player={player.data.player} wl={player.data.wl} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Played Heroes</CardTitle>
          </CardHeader>
          {playerHeroes.isPending || heroStats.isPending ? (
            <Spinner />
          ) : playerHeroes.data && heroStats.data ? (
            <HeroStatsTable playerHeroes={playerHeroes.data} heroStats={heroStats.data} />
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          {matches.isPending || heroStats.isPending ? (
            <Spinner />
          ) : matches.data && heroStats.data ? (
            <MatchHistory matches={matches.data} heroStats={heroStats.data} />
          ) : null}
        </Card>
      </div>
    </div>
  )
}
