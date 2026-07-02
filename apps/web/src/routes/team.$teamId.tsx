import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/team/$teamId')({
  component: TeamPage,
})

// fantasy_role: 4=Carry(pos1), 1=Core(mid/offlane), 2=Support(pos4/5)
const ROLE_SORT: Record<number, number> = { 4: 0, 1: 1, 2: 2 }
const ROLE_LABEL: Record<number, string> = { 4: 'Carry', 1: 'Core', 2: 'Support' }

type TeamPlayer = {
  account_id: number
  name: string | null
  games_played: number
  wins: number
  is_current_team_member: boolean
}

type TeamMatch = {
  match_id: number
  radiant: boolean
  radiant_win: boolean
  duration: number
  start_time: number
  leagueid: number
  league_name: string | null
  opposing_team_id: number
  opposing_team_name: string | null
  opposing_team_logo: string | null
}

function TeamPage() {
  const { teamId } = Route.useParams()

  const team = useQuery({
    queryKey: ['team', Number(teamId)],
    queryFn: () => opendota.team(Number(teamId)),
  })

  const players = useQuery({
    queryKey: ['team_players', teamId],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/teams/${teamId}/players`)
        .then((r) => r.json()) as Promise<TeamPlayer[]>,
  })

  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 5 * 60 * 1000,
  })

  const recentMatches = useQuery({
    queryKey: ['team_matches', teamId],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/teams/${teamId}/matches?limit=10`)
        .then((r) => r.json()) as Promise<TeamMatch[]>,
  })

  if (team.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!team.data) return <div className="text-sm text-muted">Team not found.</div>

  const t = team.data
  const wr = t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(1) : '—'

  const proMap = new Map((proPlayers.data ?? []).map((p) => [p.account_id, p]))

  const roster = (players.data ?? [])
    .filter((p) => p.is_current_team_member)
    .map((p) => ({ ...p, fantasy_role: proMap.get(p.account_id)?.fantasy_role ?? 99 }))
    .sort((a, b) => {
      const sa = ROLE_SORT[a.fantasy_role] ?? 9
      const sb = ROLE_SORT[b.fantasy_role] ?? 9
      if (sa !== sb) return sa - sb
      return b.games_played - a.games_played
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {t.logo_url && (
          <img src={t.logo_url} alt={t.name} className="h-16 w-16 object-contain rounded-lg" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <div className="text-sm text-muted">{t.tag}</div>
          <div className="mt-2 flex gap-6 text-sm">
            <div>
              <div className="font-mono text-lg text-radiant">{t.wins}</div>
              <div className="text-xs text-muted">Wins</div>
            </div>
            <div>
              <div className="font-mono text-lg text-dire">{t.losses}</div>
              <div className="text-xs text-muted">Losses</div>
            </div>
            <div>
              <div className="font-mono text-lg">{wr}%</div>
              <div className="text-xs text-muted">Win Rate</div>
            </div>
            <div>
              <div className="font-mono text-lg">{Math.round(t.rating)}</div>
              <div className="text-xs text-muted">Rating</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {players.isPending ? (
              <Spinner />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Player</th>
                    <th className="pb-2 font-normal">Role</th>
                    <th className="pb-2 font-normal text-right">Games</th>
                    <th className="pb-2 font-normal text-right">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => {
                      const wr = p.games_played > 0 ? ((p.wins / p.games_played) * 100).toFixed(1) : '—'
                      return (
                        <tr key={p.account_id} className="border-t border-border/30 text-sm hover:bg-card/40">
                          <td className="py-1.5 pr-4">
                            <a
                              href={`/player/${p.account_id}`}
                              className="hover:text-accent font-medium"
                            >
                              {p.name ?? `Player ${p.account_id}`}
                            </a>
                          </td>
                          <td className="py-1.5 text-xs text-muted">
                            {ROLE_LABEL[p.fantasy_role] ?? '—'}
                          </td>
                          <td className="py-1.5 text-right font-mono text-xs text-muted">
                            {p.games_played}
                          </td>
                          <td className="py-1.5 text-right font-mono text-xs font-medium">
                            {wr}%
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {recentMatches.isPending ? (
              <Spinner />
            ) : (
              <div className="space-y-1">
                {(recentMatches.data ?? []).map((m) => {
                  const won = m.radiant ? m.radiant_win : !m.radiant_win
                  return (
                    <a
                      key={m.match_id}
                      href={`/match/${m.match_id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${won ? 'text-radiant' : 'text-dire'}`}>
                          {won ? 'W' : 'L'}
                        </span>
                        <span className="text-muted">vs</span>
                        <span>{m.opposing_team_name ?? 'Unknown'}</span>
                      </div>
                      <span className="font-mono text-xs text-muted">{formatTimeAgo(m.start_time)}</span>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
