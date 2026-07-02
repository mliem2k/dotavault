import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { HeroStat } from 'types'
import { SearchBar } from '@/components/search/search-bar'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/eden'
import { formatTimeAgo, winRate } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function heroTotals(h: HeroStat) {
  const picks =
    h['1_pick'] + h['2_pick'] + h['3_pick'] + h['4_pick'] +
    h['5_pick'] + h['6_pick'] + h['7_pick'] + h['8_pick']
  const wins =
    h['1_win'] + h['2_win'] + h['3_win'] + h['4_win'] +
    h['5_win'] + h['6_win'] + h['7_win'] + h['8_win']
  return { picks, wins }
}

function HomePage() {
  const heroes = useQuery({
    queryKey: ['heroes'],
    queryFn: async () => {
      const { data } = await api.heroes.get()
      return data
    },
  })

  const proMatches = useQuery({
    queryKey: ['pro-matches'],
    queryFn: async () => {
      const { data } = await api.pro.matches.get()
      return data
    },
  })

  return (
    <div className="space-y-12">
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">dotavault</h1>
        <p className="text-sm text-muted">Dota 2 stats, match analysis, and replay viewer</p>
        <SearchBar />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium text-muted">Recent Pro Matches</h2>
          {proMatches.isPending && <Spinner />}
          {proMatches.data && (
            <div className="space-y-1">
              {proMatches.data.slice(0, 8).map((m) => (
                <a
                  key={m.match_id}
                  href={`/match/${m.match_id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <span className="text-foreground">
                    {m.radiant_name ?? 'Radiant'} vs {m.dire_name ?? 'Dire'}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {formatTimeAgo(m.start_time)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-medium text-muted">Top Heroes (This Week)</h2>
          {heroes.isPending && <Spinner />}
          {heroes.data && (
            <div className="space-y-1">
              {[...heroes.data]
                .sort((a, b) => {
                  const { picks: ap, wins: aw } = heroTotals(a)
                  const { picks: bp, wins: bw } = heroTotals(b)
                  return bw / (bp || 1) - aw / (ap || 1)
                })
                .slice(0, 8)
                .map((h) => {
                  const { picks, wins } = heroTotals(h)
                  return (
                    <a
                      key={h.id}
                      href={`/hero/${h.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://cdn.opendota.com${h.icon}`}
                          alt={h.localized_name}
                          className="h-6 w-6 rounded"
                        />
                        <span className="text-foreground">{h.localized_name}</span>
                      </div>
                      <span className="font-mono text-xs text-muted">{winRate(wins, picks)}</span>
                    </a>
                  )
                })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
