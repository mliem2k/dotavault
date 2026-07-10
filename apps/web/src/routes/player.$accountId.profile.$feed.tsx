import { createFileRoute } from '@tanstack/react-router'
import { RecentGames } from '@/components/player/recent_games'
import { Teammates } from '@/components/player/teammates'
import { Spinner } from '@/components/ui/spinner'
import { usePlayerData } from '@/lib/player_data_context'

export const Route = createFileRoute('/player/$accountId/profile/$feed')({
  component: FeedPage,
})

function FeedPage() {
  const { feed } = Route.useParams()
  const activeFeed = feed === 'teammates' ? 'teammates' : 'recent'
  const { matches, matchesLeagueInfo, heroStats, peers } = usePlayerData()

  if (activeFeed === 'recent') {
    return matches.isPending || heroStats.isPending ? (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    ) : matches.data && heroStats.data ? (
      <RecentGames
        matches={matches.data}
        heroStats={heroStats.data}
        leagueInfo={matchesLeagueInfo.data}
      />
    ) : null
  }

  return peers.isPending ? (
    <div className="flex justify-center py-8">
      <Spinner />
    </div>
  ) : peers.data ? (
    <Teammates peers={peers.data} />
  ) : null
}
