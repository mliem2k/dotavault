import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { SearchBar } from '@/components/search/search_bar'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatTimeAgo, heroBracketTotal, heroIconFromPath, winRate } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const heroes = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  const proMatches = useQuery({
    queryKey: ['pro-matches'],
    queryFn: () => opendota.proMatches(),
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
                  const ap = heroBracketTotal(a, 'pick')
                  const aw = heroBracketTotal(a, 'win')
                  const bp = heroBracketTotal(b, 'pick')
                  const bw = heroBracketTotal(b, 'win')
                  return bw / (bp || 1) - aw / (ap || 1)
                })
                .slice(0, 8)
                .map((h) => {
                  const picks = heroBracketTotal(h, 'pick')
                  const wins = heroBracketTotal(h, 'win')
                  return (
                    <a
                      key={h.id}
                      href={`/hero/${h.name.replace('npc_dota_hero_', '')}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={heroIconFromPath(h.icon)}
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
