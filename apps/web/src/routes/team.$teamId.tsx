import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatTimeAgo, winRate } from '@/lib/utils'

export const Route = createFileRoute('/team/$teamId')({
  component: TeamPage,
})

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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase"
        style={{
          color: '#c8c2b4',
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
          borderBottom: '1px solid #24222a',
        }}
      >
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
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
      fetch(`https://api.opendota.com/api/teams/${teamId}/players`).then((r) =>
        r.json(),
      ) as Promise<TeamPlayer[]>,
  })

  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 5 * 60 * 1000,
  })

  const recentMatches = useQuery({
    queryKey: ['team_matches', teamId],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/teams/${teamId}/matches?limit=10`).then((r) =>
        r.json(),
      ) as Promise<TeamMatch[]>,
  })

  if (team.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!team.data)
    return (
      <div className="text-sm" style={{ color: '#8a8474' }}>
        Team not found.
      </div>
    )

  const t = team.data
  const totalGames = t.wins + t.losses
  const wr = winRate(t.wins, totalGames)

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
    <div className="space-y-6 py-4">
      {/* Team header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: '#0e0c0a', borderBottom: '1px solid #2c2820' }}
      >
        <div className="flex items-center gap-5 flex-wrap">
          {t.logo_url && (
            <img
              src={t.logo_url}
              alt={t.name}
              className="h-16 w-16 object-contain shrink-0"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}
            />
          )}
          <div className="min-w-0">
            <h1
              className="text-[32px] font-bold leading-tight uppercase truncate"
              style={{ color: '#f0eae0', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}
            >
              {t.name}
            </h1>
            {t.tag && (
              <div
                className="text-[13px] uppercase tracking-widest mt-0.5"
                style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}
              >
                {t.tag}
              </div>
            )}
          </div>

          <div className="flex items-center gap-8 ml-auto">
            {(
              [
                { value: t.wins.toLocaleString(), label: 'Wins', color: '#8ec63f' },
                { value: t.losses.toLocaleString(), label: 'Losses', color: '#d14a38' },
                {
                  value: wr,
                  label: 'Win Rate',
                  color: t.wins / (totalGames || 1) >= 0.5 ? '#8ec63f' : '#d14a38',
                },
                { value: Math.round(t.rating).toLocaleString(), label: 'Rating', color: '#dcd6c8' },
              ] as { value: string; label: string; color: string }[]
            ).map((stat) => (
              <div key={stat.label}>
                <div
                  className="text-[10px] uppercase tracking-widest mb-0.5"
                  style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}
                >
                  {stat.label}
                </div>
                <div
                  className="text-[22px] font-bold leading-tight tabular-nums"
                  style={{ color: stat.color, fontFamily: 'var(--font-dota)' }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Roster">
          {players.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {(['Player', 'Role', 'Games', 'Win%'] as string[]).map((h, i) => (
                    <th
                      key={h}
                      className={`pb-2 text-[11px] font-bold uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((p, i) => {
                  const pwr =
                    p.games_played > 0 ? ((p.wins / p.games_played) * 100).toFixed(1) : null
                  return (
                    <tr
                      key={p.account_id}
                      style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                    >
                      <td className="py-1.5 pr-4">
                        <a
                          href={`/player/${p.account_id}`}
                          className="text-[14px] hover:text-white"
                          style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                        >
                          {p.name ?? `Player ${p.account_id}`}
                        </a>
                      </td>
                      <td
                        className="py-1.5 text-[12px]"
                        style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                      >
                        {ROLE_LABEL[p.fantasy_role] ?? ''}
                      </td>
                      <td
                        className="py-1.5 text-right text-[13px] tabular-nums"
                        style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                      >
                        {p.games_played}
                      </td>
                      <td
                        className="py-1.5 text-right text-[13px] font-semibold tabular-nums"
                        style={{
                          color:
                            pwr == null ? '#4a4436' : Number(pwr) >= 50 ? '#8ec63f' : '#d14a38',
                          fontFamily: 'var(--font-dota)',
                        }}
                      >
                        {pwr != null ? `${pwr}%` : 'n/a'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Recent Matches">
          {recentMatches.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div>
              {(recentMatches.data ?? []).map((m, i) => {
                const won = m.radiant ? m.radiant_win : !m.radiant_win
                return (
                  <a
                    key={m.match_id}
                    href={`/match/${m.match_id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.03]"
                    style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[13px] font-bold uppercase shrink-0"
                        style={{
                          color: won ? '#8ec63f' : '#d14a38',
                          fontFamily: 'var(--font-dota)',
                        }}
                      >
                        {won ? 'W' : 'L'}
                      </span>
                      <span
                        className="text-[14px] truncate"
                        style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                      >
                        vs {m.opposing_team_name ?? 'Unknown'}
                      </span>
                    </div>
                    <span
                      className="text-[12px] tabular-nums shrink-0"
                      style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                    >
                      {formatTimeAgo(m.start_time)}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
