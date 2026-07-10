import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { applySort, useSort } from '@/lib/sortable'
import { tiChampionships } from '@/lib/ti_champions'
import { usePageTitle } from '@/lib/title'
import { formatTimeAgo, winRate } from '@/lib/utils'

type SortKey = 'player' | 'role' | 'games' | 'winrate'

export const Route = createFileRoute('/team/$teamId')({
  component: TeamPage,
})

// Valve's Fantasy_Roles enum (dota_shared_enums.proto): 0 undefined,
// 1 core (i.e. carry), 2 support, 3 offlane, 4 mid. Sorted in standard
// draft position order 1/2/3/4-5.
const ROLE_SORT: Record<number, number> = { 1: 0, 4: 1, 3: 2, 2: 3 }
const ROLE_LABEL: Record<number, string> = { 1: 'Carry', 4: 'Mid', 3: 'Offlane', 2: 'Support' }

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
    <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
      <div
        className="px-4 py-3 uppercase text-foreground font-display border-b border-border"
        style={{
          background: 'rgba(8,10,12,0.85)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
        }}
      >
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function TeamPage() {
  usePageTitle('Team')
  const { teamId } = Route.useParams()
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('games', 'desc')

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

  const currentAccountIds = (players.data ?? [])
    .filter((p) => p.is_current_team_member)
    .map((p) => p.account_id)
  const roleSignal = useQuery({
    queryKey: ['team_role_signal', teamId, currentAccountIds],
    queryFn: () => opendota.teamRoleSignal(currentAccountIds),
    enabled: currentAccountIds.length > 0,
    staleTime: 10 * 60 * 1000,
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

  if (!team.data) return <div className="text-sm text-muted">Team not found.</div>

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

  // Two players sharing a role isn't a bug: OpenDota tags stand-ins with
  // the same fantasy_role as the regular starter they filled in for. Flag
  // whoever has far fewer games than that role's top player instead of
  // showing them as equal, undifferentiated "Carry"s.
  const maxGamesByRole = new Map<number, number>()
  for (const p of roster) {
    maxGamesByRole.set(
      p.fantasy_role,
      Math.max(maxGamesByRole.get(p.fantasy_role) ?? 0, p.games_played),
    )
  }
  const isStandIn = (p: (typeof roster)[number]) => {
    const max = maxGamesByRole.get(p.fantasy_role) ?? 0
    return max > 0 && p.games_played < max * 0.3
  }

  // Refines fantasy_role (Carry/Support/Offlane/Mid, no soft-vs-hard split)
  // into the full 5 positions using two verified signals rather than
  // guessing: among a roster's "Support"-tagged players, the one with
  // lower average GPM is reliably the hard support (checked against a
  // real known case: Team Falcons' Cr1t-, a well known hard support,
  // scored lower than Sneyking, a soft support). A player with no
  // fantasy_role at all but whose games are overwhelmingly lane_role 2
  // is unambiguously a mid laner even without that field set. Anything
  // else stays as-is rather than guessing carry vs offlane vs support
  // from lane alone, which isn't reliable.
  const gpmByAccount = new Map((roleSignal.data?.gpm ?? []).map((g) => [g.account_id, g.avg_gpm]))
  const laneByAccount = new Map<number, { lane_role: number; games: number }[]>()
  for (const l of roleSignal.data?.lane ?? []) {
    if (!laneByAccount.has(l.account_id)) laneByAccount.set(l.account_id, [])
    laneByAccount.get(l.account_id)?.push(l)
  }
  const supportAccounts = roster.filter((p) => p.fantasy_role === 2).map((p) => p.account_id)
  const hardSupportAccount =
    supportAccounts.length >= 2
      ? supportAccounts.reduce(
          (lowest, id) =>
            (gpmByAccount.get(id) ?? Number.POSITIVE_INFINITY) <
            (gpmByAccount.get(lowest) ?? Number.POSITIVE_INFINITY)
              ? id
              : lowest,
          supportAccounts[0],
        )
      : null

  const roleLabelFor = (p: (typeof roster)[number]): string => {
    if (p.fantasy_role === 2 && supportAccounts.length >= 2) {
      return p.account_id === hardSupportAccount ? 'Hard Support' : 'Soft Support'
    }
    if (ROLE_LABEL[p.fantasy_role]) return ROLE_LABEL[p.fantasy_role]
    const laneGames = laneByAccount.get(p.account_id) ?? []
    const totalLaneGames = laneGames.reduce((s, l) => s + l.games, 0)
    const midGames = laneGames.find((l) => l.lane_role === 2)?.games ?? 0
    if (totalLaneGames > 0 && midGames / totalLaneGames > 0.6) return 'Mid'
    return ''
  }

  const sortedRoster = applySort(roster, sortDir, (a, b) => {
    switch (sortKey) {
      case 'player':
        return (a.name ?? `Player ${a.account_id}`).localeCompare(
          b.name ?? `Player ${b.account_id}`,
        )
      case 'role':
        return (ROLE_SORT[a.fantasy_role] ?? 9) - (ROLE_SORT[b.fantasy_role] ?? 9)
      case 'winrate':
        return (
          (a.games_played > 0 ? a.wins / a.games_played : -1) -
          (b.games_played > 0 ? b.wins / b.games_played : -1)
        )
      default:
        return a.games_played - b.games_played
    }
  })

  return (
    <div className="space-y-6 py-4">
      {/* Team header */}
      {/* #0e0c0a and #2c2820 are not in the Token Mapping Reference (close to but
          distinct from bg-background/border-border) — left as-is per task instructions. */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: '#0e0c0a', borderBottom: '1px solid #2c2820' }}
      >
        <div className="flex items-center gap-5 flex-wrap">
          {t.logo_url && (
            <img
              src={t.logo_url}
              alt={t.name}
              width={64}
              height={64}
              loading="lazy"
              className="h-16 w-16 object-contain shrink-0"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1
                className="text-[32px] font-bold leading-tight uppercase truncate text-foreground font-display"
                style={{ letterSpacing: '2px' }}
              >
                {t.name}
              </h1>
              {tiChampionships(t.team_id).length > 0 && (
                <span
                  className="shrink-0 px-2 py-0.5 text-[13px] font-bold uppercase text-gold"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(242,201,76,0.5)',
                    letterSpacing: '1px',
                  }}
                  title={`The International Champion: ${tiChampionships(t.team_id)
                    .map((c) => (c.wonAs ? `TI${c.year} as ${c.wonAs}` : `TI${c.year}`))
                    .join(', ')}`}
                >
                  TI Champion{' '}
                  {tiChampionships(t.team_id)
                    .map((c) => c.year)
                    .join('/')}
                </span>
              )}
            </div>
            {t.tag && (
              // #77715f is not in the Token Mapping Reference (close to but distinct
              // from #8a8474/#5a5648 text-muted) — left as-is per task instructions.
              <div
                className="text-[13px] uppercase tracking-widest mt-0.5 font-dota"
                style={{ color: '#77715f' }}
              >
                {t.tag}
              </div>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-4 sm:gap-8 ml-auto">
            {(
              [
                { value: t.wins.toLocaleString(), label: 'Wins', color: 'text-radiant' },
                { value: t.losses.toLocaleString(), label: 'Losses', color: 'text-dire' },
                {
                  value: wr,
                  label: 'Win Rate',
                  color: t.wins / (totalGames || 1) >= 0.5 ? 'text-radiant' : 'text-dire',
                },
                {
                  value: Math.round(t.rating).toLocaleString(),
                  label: 'Rating',
                  color: 'text-foreground',
                },
              ] as { value: string; label: string; color: string }[]
            ).map((stat) => (
              <div key={stat.label}>
                {/* #5a5446 is not in the Token Mapping Reference (close to but distinct
                    from #5a5648 text-muted) — left as-is per task instructions. */}
                <div
                  className="text-[11px] uppercase tracking-widest mb-0.5 font-dota"
                  style={{ color: '#5a5446' }}
                >
                  {stat.label}
                </div>
                <div
                  className={`text-[22px] font-bold leading-tight tabular-nums font-dota ${stat.color}`}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        <Panel title="Roster">
          {players.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-widest text-left">
                    <SortHeader
                      label="Player"
                      sortKey="player"
                      active={sortKey === 'player'}
                      dir={sortDir}
                      onClick={onSort}
                      className="font-dota"
                      style={{ color: 'var(--color-muted)' }}
                    />
                  </th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-widest text-left">
                    <SortHeader
                      label="Role"
                      sortKey="role"
                      active={sortKey === 'role'}
                      dir={sortDir}
                      onClick={onSort}
                      className="font-dota"
                      style={{ color: 'var(--color-muted)' }}
                    />
                  </th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-widest text-right">
                    <SortHeader
                      label="Games"
                      sortKey="games"
                      active={sortKey === 'games'}
                      dir={sortDir}
                      onClick={onSort}
                      className="justify-end font-dota"
                      style={{ color: 'var(--color-muted)' }}
                    />
                  </th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-widest text-right">
                    <SortHeader
                      label="Win%"
                      sortKey="winrate"
                      active={sortKey === 'winrate'}
                      dir={sortDir}
                      onClick={onSort}
                      className="justify-end font-dota"
                      style={{ color: 'var(--color-muted)' }}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRoster.map((p, i) => {
                  const pwr =
                    p.games_played > 0 ? ((p.wins / p.games_played) * 100).toFixed(1) : null
                  return (
                    <tr key={p.account_id} className={i === 0 ? '' : 'border-t border-border'}>
                      <td className="py-1.5 pr-4">
                        <a
                          href={`/player/${p.account_id}`}
                          className="text-[14px] hover:text-white text-foreground font-dota"
                        >
                          {p.name ?? `Player ${p.account_id}`}
                        </a>
                      </td>
                      <td className="py-1.5 text-[12px] text-muted font-dota">
                        {roleLabelFor(p)}
                        {isStandIn(p) && (
                          <Badge
                            variant="default"
                            className="ml-1.5"
                            title="Far fewer games than this role's regular starter, likely a stand-in"
                          >
                            Stand-in
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-[13px] tabular-nums text-muted font-dota">
                        {p.games_played}
                      </td>
                      <td
                        className={`py-1.5 text-right text-[13px] font-semibold tabular-nums font-dota ${
                          pwr == null
                            ? 'text-muted'
                            : Number(pwr) >= 50
                              ? 'text-radiant'
                              : 'text-dire'
                        }`}
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
                    className={`flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-[13px] font-bold uppercase shrink-0 font-dota ${won ? 'text-radiant' : 'text-dire'}`}
                      >
                        {won ? 'W' : 'L'}
                      </span>
                      <span className="text-[14px] truncate text-foreground font-dota">
                        vs {m.opposing_team_name ?? 'Unknown'}
                      </span>
                    </div>
                    <span className="text-[12px] tabular-nums shrink-0 text-muted font-dota">
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
