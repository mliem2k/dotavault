import { createFileRoute } from '@tanstack/react-router'
import { HeroStatsTable } from '@/components/player/hero_stats_table'
import { PlayerStats } from '@/components/player/player_stats'
import { Spinner } from '@/components/ui/spinner'
import { usePlayerData } from '@/lib/player_data_context'

const C = { white: 'var(--color-white)', panel: 'rgba(16,19,22,0.72)' }

export const Route = createFileRoute('/player/$accountId/stats')({
  component: StatsTabPage,
})

function StatsTabPage() {
  const { totals, countsQ, wl, playerHeroes, heroStats, matches } = usePlayerData()
  return (
    <div className="mt-3 space-y-4">
      {totals.isPending || countsQ.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : totals.data ? (
        <PlayerStats totals={totals.data} counts={countsQ.data} wl={wl} matches={matches.data} />
      ) : null}
      <div className="max-w-[720px] mx-auto" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: 'rgba(8,10,12,0.7)' }}
        >
          Most Played Heroes
        </div>
        <div className="p-4">
          {playerHeroes.isPending || heroStats.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : playerHeroes.data && heroStats.data ? (
            <HeroStatsTable playerHeroes={playerHeroes.data} heroStats={heroStats.data} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
