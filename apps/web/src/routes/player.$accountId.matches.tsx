import { createFileRoute } from '@tanstack/react-router'
import { AllMatches } from '@/components/player/all_matches'
import { Spinner } from '@/components/ui/spinner'
import { usePlayerData } from '@/lib/player_data_context'

export const Route = createFileRoute('/player/$accountId/matches')({
  component: MatchesTabPage,
})

function MatchesTabPage() {
  const { accountId, heroStats } = usePlayerData()
  return (
    <div className="mt-3">
      {heroStats.isPending ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : heroStats.data ? (
        <AllMatches accountId={accountId} heroStats={heroStats.data} />
      ) : null}
    </div>
  )
}
