import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/pro')({
  component: ProPage,
})

function ProPage() {
  const matches = useQuery({
    queryKey: ['pro-matches'],
    queryFn: () => opendota.proMatches(),
  })

  const players = useQuery({
    queryKey: ['pro-players'],
    queryFn: () => opendota.proPlayers(),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Pro Scene</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Pro Matches</CardTitle>
          </CardHeader>
          {matches.isPending && <Spinner />}
          {matches.data && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-2 font-normal">Match</th>
                  <th className="pb-2 font-normal text-right">Duration</th>
                  <th className="pb-2 font-normal text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {matches.data.slice(0, 20).map((m, i) => (
                  <tr
                    key={m.match_id}
                    className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                  >
                    <td className="py-1.5">
                      <a href={`/match/${m.match_id}`} className="hover:text-accent">
                        <div className="text-foreground">
                          {m.radiant_name ?? 'Radiant'} vs {m.dire_name ?? 'Dire'}
                        </div>
                        {m.league_name && (
                          <div className="text-xs text-muted">{m.league_name}</div>
                        )}
                      </a>
                    </td>
                    <td className="py-1.5 text-right font-mono text-muted">
                      {formatDuration(m.duration)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-muted">
                      {formatTimeAgo(m.start_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pro Players</CardTitle>
          </CardHeader>
          {players.isPending && <Spinner />}
          {players.data && (
            <div className="space-y-1">
              {players.data
                .filter((p) => p.is_pro && p.team_name)
                .slice(0, 20)
                .map((p) => (
                  <a
                    key={p.account_id}
                    href={`/player/${p.account_id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5"
                  >
                    <img
                      src={p.avatarmedium}
                      alt={p.personaname}
                      className="h-7 w-7 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-foreground">{p.name ?? p.personaname}</div>
                      <div className="text-xs text-muted">{p.team_name}</div>
                    </div>
                    {p.loccountrycode && (
                      <span className="font-mono text-xs text-muted">{p.loccountrycode}</span>
                    )}
                  </a>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
