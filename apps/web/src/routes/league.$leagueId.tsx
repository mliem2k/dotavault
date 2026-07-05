import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'
import { formatDuration, formatTimeAgo, heroIconUrl } from '@/lib/utils'

export const Route = createFileRoute('/league/$leagueId')({
  component: LeaguePage,
})

// OpenDota's "excluded" tier just means "not counted toward pro stats"
// (true of most qualifier brackets), not "not a real event", so relabel it
// for the qualifiers list.
const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  professional: 'Professional',
  amateur: 'Amateur',
  minor: 'Minor',
  excluded: 'Qualifier',
}

/* League report: draft stats, team standings, and the match list scoped to
   one specific tournament, inspired by D2-LRG's per-league reports (which
   is a deprecated, self-hosted PHP/MySQL tool; this is our own take on the
   same idea, built on OpenDota's SQL Explorer, same pattern as the Pro Only
   match filter). */

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 uppercase"
        style={{ color: '#c8c2b4', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '3px', borderBottom: '1px solid #24222a' }}
      >
        <span>{title}</span>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function DraftPanel({
  leagueId,
  heroMap,
}: {
  leagueId: number
  heroMap: Map<number, { localized_name: string; name: string }>
}) {
  const heroStats = useQuery({
    queryKey: ['league_hero_stats', leagueId],
    queryFn: () => opendota.leagueHeroStats(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const banStats = useQuery({
    queryKey: ['league_ban_stats', leagueId],
    queryFn: () => opendota.leagueBanStats(leagueId),
    staleTime: 10 * 60 * 1000,
  })

  const banByHero = useMemo(() => new Map((banStats.data ?? []).map((b) => [b.hero_id, b.bans])), [banStats.data])
  const topPicks = [...(heroStats.data ?? [])].sort((a, b) => b.picks - a.picks).slice(0, 15)
  const maxPick = Math.max(1, ...topPicks.map((h) => h.picks))

  return (
    <Panel title="Draft">
      {(heroStats.isPending || banStats.isPending) && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {topPicks.length === 0 && !heroStats.isPending && (
        <div className="py-8 text-center text-[13px]" style={{ color: '#8a8474' }}>
          No draft data for this league yet.
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-dota)' }}>
        <thead>
          <tr className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#8a8474' }}>
            <th className="pb-2 text-left">Hero</th>
            <th className="pb-2 px-2 text-right">Picks</th>
            <th className="pb-2 px-2 text-right">Win Rate</th>
            <th className="pb-2 px-2 text-right">Bans</th>
          </tr>
        </thead>
        <tbody>
          {topPicks.map((h) => {
            const hero = heroMap.get(h.hero_id)
            const wr = h.picks > 0 ? (h.wins / h.picks) * 100 : 0
            const bans = banByHero.get(h.hero_id) ?? 0
            return (
              <tr key={h.hero_id} style={{ borderTop: '1px solid #1c1810' }}>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    {hero && <img src={heroIconUrl(hero.name)} alt="" className="h-6 w-6 rounded" />}
                    <span className="truncate text-[14px]" style={{ color: '#dcd6c8' }}>
                      {hero?.localized_name ?? `Hero ${h.hero_id}`}
                    </span>
                  </div>
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#dcd6c8' }}>
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-[6px]" style={{ width: 60, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${(h.picks / maxPick) * 100}%`, height: '100%', background: '#c9a94a' }} />
                    </div>
                    {h.picks}
                  </div>
                </td>
                <td
                  className="px-2 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: wr >= 52 ? '#8ec63f' : wr < 48 ? '#d14a38' : '#dcd6c8' }}
                >
                  {wr.toFixed(1)}%
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#d14a38' }}>
                  {bans || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

function StandingsPanel({
  leagueId,
  teamMap,
}: {
  leagueId: number
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const standings = useQuery({
    queryKey: ['league_standings', leagueId],
    queryFn: () => opendota.leagueTeamStandings(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const navigate = useNavigate()

  return (
    <Panel title="Team Standings">
      {standings.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {standings.data?.length === 0 && !standings.isPending && (
        <div className="py-8 text-center text-[13px]" style={{ color: '#8a8474' }}>
          No team-attributed matches in this league.
        </div>
      )}
      {standings.data && standings.data.length > 0 && (
        <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-dota)' }}>
          <thead>
            <tr className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#8a8474' }}>
              <th className="pb-2 pr-2 text-right w-8">#</th>
              <th className="pb-2 text-left">Team</th>
              <th className="pb-2 px-3 text-right">W</th>
              <th className="pb-2 px-3 text-right">L</th>
              <th className="pb-2 pl-3 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {standings.data.map((s, i) => {
              const team = teamMap.get(s.team_id)
              const games = s.wins + s.losses
              const wr = games > 0 ? (s.wins / games) * 100 : 0
              return (
                <tr
                  key={s.team_id}
                  onClick={() => navigate({ to: '/team/$teamId', params: { teamId: String(s.team_id) } })}
                  className="cursor-pointer hover:bg-white/[0.03]"
                  style={{ borderTop: '1px solid #1c1810' }}
                >
                  <td className="py-2 pr-2 text-right text-[13px] tabular-nums" style={{ color: '#4a4436' }}>
                    {i + 1}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2.5">
                      {team?.logo_url ? (
                        <img
                          src={team.logo_url}
                          alt=""
                          className="h-7 w-7 shrink-0 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.visibility = 'hidden'
                          }}
                        />
                      ) : (
                        <span className="h-7 w-7 shrink-0" />
                      )}
                      <span className="truncate text-[15px]" style={{ color: '#dcd6c8' }}>
                        {team?.name ?? `Team ${s.team_id}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 text-right text-[14px] tabular-nums" style={{ color: '#8ec63f' }}>
                    {s.wins}
                  </td>
                  <td className="px-3 text-right text-[14px] tabular-nums" style={{ color: '#d14a38' }}>
                    {s.losses}
                  </td>
                  <td
                    className="pl-3 text-right text-[14px] font-semibold tabular-nums"
                    style={{ color: wr >= 55 ? '#8ec63f' : wr < 45 ? '#d14a38' : '#dcd6c8' }}
                  >
                    {wr.toFixed(0)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

type LeagueMatchRow = {
  match_id: number
  start_time: number
  duration: number
  radiant_team_id: number | null
  dire_team_id: number | null
  radiant_win: boolean
  radiant_score: number | null
  dire_score: number | null
  series_id: number | null
  series_type: number | null
}

type Series = {
  key: string
  teamA: number | null
  teamB: number | null
  scoreA: number
  scoreB: number
  bestOf: number
  games: LeagueMatchRow[]
  lastStartTime: number
}

// OpenDota gives per-game rows with a shared series_id but no fixed side
// per team (radiant/dire can swap between games), so re-derive a stable
// "team A vs team B" pairing and series score by walking the games in
// order. A null/zero series_id (or one shared by unrelated pairings, which
// happens) still gets its own single-game "series" via a per-team-pair key
// so unrelated Bo1s never get merged together.
function buildSeries(matches: LeagueMatchRow[]): Series[] {
  const bySeriesId = new Map<string, LeagueMatchRow[]>()
  for (const m of matches) {
    const pairKey = [m.radiant_team_id, m.dire_team_id].sort((a, b) => (a ?? 0) - (b ?? 0)).join('-')
    const key = m.series_id ? `s${m.series_id}-${pairKey}` : `m${m.match_id}`
    if (!bySeriesId.has(key)) bySeriesId.set(key, [])
    bySeriesId.get(key)?.push(m)
  }
  const out: Series[] = []
  for (const [key, games] of bySeriesId) {
    games.sort((a, b) => a.start_time - b.start_time)
    const teamA = games[0].radiant_team_id
    const teamB = games[0].dire_team_id
    let scoreA = 0
    let scoreB = 0
    for (const g of games) {
      const radiantIsA = g.radiant_team_id === teamA
      const aWon = radiantIsA ? g.radiant_win : !g.radiant_win
      if (aWon) scoreA++
      else scoreB++
    }
    const bestOf = games[0].series_type === 2 ? 5 : games[0].series_type === 1 ? 3 : games.length > 1 ? games.length : 1
    out.push({ key, teamA, teamB, scoreA, scoreB, bestOf, games, lastStartTime: games[games.length - 1].start_time })
  }
  return out.sort((a, b) => b.lastStartTime - a.lastStartTime)
}

// Valve/OpenDota don't expose a round or bracket-slot field, so there's no
// way to know the *official* bracket shape. This infers a reasonable
// approximation instead: walk series oldest-first, and a team's next
// series happens one round after whatever round they were last seen in.
// That's exact for a clean single-elimination bracket; for a Swiss stage
// (round-robin-ish, no elimination) it degrades gracefully into "the Nth
// time this team played", which still reads fine as a column layout even
// though it isn't a true bracket tree, just an approximate one.
function inferRounds(series: Series[]): Series[][] {
  const roundOf = new Map<number, number>()
  const rounds: Series[][] = []
  const oldestFirst = [...series].sort((a, b) => a.lastStartTime - b.lastStartTime)
  for (const s of oldestFirst) {
    const rA = s.teamA != null ? (roundOf.get(s.teamA) ?? 0) : 0
    const rB = s.teamB != null ? (roundOf.get(s.teamB) ?? 0) : 0
    const round = Math.max(rA, rB)
    if (!rounds[round]) rounds[round] = []
    rounds[round].push(s)
    if (s.teamA != null) roundOf.set(s.teamA, round + 1)
    if (s.teamB != null) roundOf.set(s.teamB, round + 1)
  }
  return rounds
}

function BracketCard({
  s,
  teamMap,
}: {
  s: Series
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const teamA = teamMap.get(s.teamA ?? -1)
  const teamB = teamMap.get(s.teamB ?? -1)
  const aWon = s.scoreA > s.scoreB
  const row = (name: string, score: number, won: boolean) => (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5" style={{ background: won ? 'rgba(142,198,63,0.08)' : 'transparent' }}>
      <span
        className="truncate text-[13px]"
        style={{ color: won ? '#8ec63f' : '#a09a8c', fontFamily: 'var(--font-dota)', fontWeight: won ? 600 : 400 }}
      >
        {name}
      </span>
      <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: won ? '#8ec63f' : '#5a5648' }}>
        {score}
      </span>
    </div>
  )
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1c1810', width: 220 }}>
      {row(teamA?.name ?? (s.teamA ? `Team ${s.teamA}` : 'TBD'), s.scoreA, aWon)}
      <div style={{ borderTop: '1px solid #1c1810' }}>{row(teamB?.name ?? (s.teamB ? `Team ${s.teamB}` : 'TBD'), s.scoreB, !aWon)}</div>
    </div>
  )
}

function BracketView({
  series,
  teamMap,
}: {
  series: Series[]
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const rounds = useMemo(() => inferRounds(series), [series])
  return (
    <div>
      <div className="pb-3 text-[12px]" style={{ color: '#5a5648' }}>
        Approximate round grouping inferred from match order, Valve doesn't publish official bracket
        positions through this data source.
      </div>
      <div className="flex items-start gap-6 overflow-x-auto pb-2">
        {rounds.map((round, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-4">
            <div className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#8a8474' }}>
              Round {i + 1}
            </div>
            {round.map((s) => (
              <BracketCard key={s.key} s={s} teamMap={teamMap} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeriesPanel({
  leagueId,
  teamMap,
}: {
  leagueId: number
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const matches = useQuery({
    queryKey: ['league_matches', leagueId],
    queryFn: () => opendota.leagueMatches(leagueId, 500, 0),
    staleTime: 5 * 60 * 1000,
  })
  const [view, setView] = useState<'list' | 'bracket'>('list')

  const series = useMemo(() => buildSeries(matches.data ?? []), [matches.data])

  return (
    <Panel
      title="Results"
      action={
        <div className="flex items-center gap-1">
          {(['list', 'bracket'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="px-2.5 py-1 text-[11px] font-bold uppercase cursor-pointer"
              style={{
                color: view === v ? '#0b0b0d' : '#8a8474',
                background: view === v ? '#c9a94a' : 'rgba(255,255,255,0.05)',
                letterSpacing: '1px',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      }
    >
      {matches.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {!matches.isPending && view === 'bracket' && <BracketView series={series} teamMap={teamMap} />}
      {!matches.isPending && view === 'list' && series.map((s, i) => {
        const teamA = teamMap.get(s.teamA ?? -1)
        const teamB = teamMap.get(s.teamB ?? -1)
        const aWon = s.scoreA > s.scoreB
        return (
          <div key={s.key} className="py-2.5" style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="truncate text-[15px]"
                    style={{ color: aWon ? '#8ec63f' : '#a09a8c', fontFamily: 'var(--font-dota)', fontWeight: aWon ? 600 : 400 }}
                  >
                    {teamA?.name ?? (s.teamA ? `Team ${s.teamA}` : 'TBD')}
                  </span>
                  <span
                    className="shrink-0 px-2 py-0.5 text-[14px] font-bold tabular-nums"
                    style={{ color: '#dcd6c8', background: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-dota)' }}
                  >
                    {s.scoreA} : {s.scoreB}
                  </span>
                  <span
                    className="truncate text-[15px]"
                    style={{ color: !aWon ? '#8ec63f' : '#a09a8c', fontFamily: 'var(--font-dota)', fontWeight: !aWon ? 600 : 400 }}
                  >
                    {teamB?.name ?? (s.teamB ? `Team ${s.teamB}` : 'TBD')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12px] uppercase tracking-wider" style={{ color: '#5a5648', fontFamily: 'var(--font-dota)' }}>
                  Bo{s.bestOf}
                </div>
                <div className="text-[12px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                  {formatTimeAgo(s.lastStartTime)}
                </div>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-0.5">
              {s.games.map((g) => {
                const radiantIsA = g.radiant_team_id === s.teamA
                const aWonGame = radiantIsA ? g.radiant_win : !g.radiant_win
                return (
                  <a
                    key={g.match_id}
                    href={`/match/${g.match_id}`}
                    className="px-2 py-1 text-[12px] tabular-nums hover:bg-white/[0.05]"
                    style={{ background: 'rgba(255,255,255,0.03)', color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                    title={`${formatDuration(g.duration)} · ${g.radiant_score ?? '?'}-${g.dire_score ?? '?'}`}
                  >
                    <span style={{ color: aWonGame ? '#8ec63f' : '#d14a38' }}>{aWonGame ? 'W' : 'L'}</span>{' '}
                    {formatDuration(g.duration)}
                  </a>
                )
              })}
            </div>
          </div>
        )
      })}
    </Panel>
  )
}

function RosterPanel({
  leagueId,
  teamMap,
}: {
  leagueId: number
  teamMap: Map<number, { name: string | null; tag: string | null; logo_url: string | null }>
}) {
  const roster = useQuery({
    queryKey: ['league_roster', leagueId],
    queryFn: () => opendota.leagueRoster(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 60 * 60 * 1000,
  })
  const proMap = useMemo(
    () => new Map((proPlayers.data ?? []).map((p) => [p.account_id, p])),
    [proPlayers.data],
  )

  // proPlayers only covers players OpenDota considers notable; plenty of
  // real competitors (especially in qualifiers) aren't in it at all, so
  // they'd otherwise show as "Player <id>". Their individual profile still
  // has a personaname, so fetch that as a fallback for whoever's missing.
  // Capped so a huge open-qualifier bracket (dozens of teams, mostly
  // unlisted players) can't fire hundreds of individual requests at once;
  // anyone past the cap just keeps the "Player <id>" fallback.
  const missingIds = useMemo(() => {
    if (!roster.data) return []
    const ids = new Set<number>()
    for (const r of roster.data) if (!proMap.has(r.account_id)) ids.add(r.account_id)
    return [...ids].slice(0, 80)
  }, [roster.data, proMap])

  const fallbackNames = useQuery({
    queryKey: ['league_roster_fallback_names', leagueId, missingIds],
    queryFn: async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const p = await opendota.player(String(id))
            return [id, p.profile?.personaname ?? null] as const
          } catch {
            return [id, null] as const
          }
        }),
      )
      return new Map(entries.filter((e): e is [number, string] => e[1] != null))
    },
    enabled: missingIds.length > 0,
    staleTime: 60 * 60 * 1000,
  })

  const byTeam = useMemo(() => {
    const groups = new Map<number, { account_id: number; games: number; wins: number }[]>()
    for (const r of roster.data ?? []) {
      if (r.team_id == null) continue
      if (!groups.has(r.team_id)) groups.set(r.team_id, [])
      groups.get(r.team_id)?.push(r)
    }
    return [...groups.entries()]
      .map(([teamId, players]) => ({
        teamId,
        players: players.sort((a, b) => b.games - a.games),
        totalGames: Math.max(...players.map((p) => p.games)),
      }))
      .sort((a, b) => b.totalGames - a.totalGames)
  }, [roster.data])

  return (
    <Panel title="Participants">
      {(roster.isPending || proPlayers.isPending) && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {byTeam.length === 0 && !roster.isPending && (
        <div className="py-8 text-center text-[13px]" style={{ color: '#8a8474' }}>
          No team-attributed rosters in this league.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {byTeam.map((g) => {
          const team = teamMap.get(g.teamId)
          return (
            <div key={g.teamId}>
              <a href={`/team/${g.teamId}`} className="flex items-center gap-2 py-1 hover:opacity-80">
                {team?.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt=""
                    className="h-5 w-5 shrink-0 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}
                <span className="truncate text-[14px] font-semibold" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                  {team?.name ?? `Team ${g.teamId}`}
                </span>
              </a>
              <div className="ml-7">
                {g.players.map((p) => {
                  const pro = proMap.get(p.account_id)
                  const wr = p.games > 0 ? (p.wins / p.games) * 100 : 0
                  return (
                    <a
                      key={p.account_id}
                      href={`/player/${p.account_id}`}
                      className="flex items-center gap-2 py-0.5 hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: '#c8c2b4', fontFamily: 'var(--font-dota)' }}>
                        {pro?.name ?? pro?.personaname ?? fallbackNames.data?.get(p.account_id) ?? `Player ${p.account_id}`}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums" style={{ color: '#5a5648', fontFamily: 'var(--font-dota)' }}>
                        {p.games}g
                      </span>
                      <span
                        className="shrink-0 text-[12px] font-semibold tabular-nums"
                        style={{ color: wr >= 55 ? '#8ec63f' : wr < 45 ? '#d14a38' : '#8a8474', fontFamily: 'var(--font-dota)' }}
                      >
                        {wr.toFixed(0)}%
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

type LeagueTab = 'standings' | 'results' | 'draft' | 'participants'
const LEAGUE_TABS: { key: LeagueTab; label: string }[] = [
  { key: 'standings', label: 'Standings' },
  { key: 'results', label: 'Results' },
  { key: 'draft', label: 'Draft' },
  { key: 'participants', label: 'Participants' },
]

function LeaguePage() {
  const { leagueId } = Route.useParams()
  const id = Number(leagueId)
  const [tab, setTab] = useState<LeagueTab>('standings')

  const summary = useQuery({
    queryKey: ['league_summary', id],
    queryFn: () => opendota.leagueSummary(id),
    staleTime: 30 * 60 * 1000,
    enabled: Number.isInteger(id) && id > 0,
  })
  const leagues = useQuery({
    queryKey: ['leagues_list'],
    queryFn: () => opendota.leaguesList(),
    staleTime: 60 * 60 * 1000,
  })
  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 60 * 60 * 1000,
  })
  const teams = useQuery({
    queryKey: ['teams_list'],
    queryFn: () => opendota.teamsList(),
    staleTime: 30 * 60 * 1000,
  })

  const league = leagues.data?.find((l) => l.leagueid === id)
  usePageTitle(league?.name ? `League · ${league.name}` : 'League')

  // The main event's own leagueid often has no matches yet (it hasn't been
  // played), while its qualifiers already have real data under sibling
  // leagueids. OpenDota names those with the same prefix, e.g. "The
  // International 2026 - Regional Qualifier Europe", so surface them
  // instead of leaving the page blank.
  const relatedLeagues = useMemo(() => {
    if (!league?.name) return []
    const prefix = `${league.name} - `
    return (leagues.data ?? [])
      .filter((l) => l.leagueid !== id && l.name?.startsWith(prefix))
      .map((l) => ({ ...l, subName: l.name.slice(prefix.length) }))
      .sort((a, b) => a.subName.localeCompare(b.subName))
  }, [leagues.data, league?.name, id])

  const heroMap = useMemo(() => new Map((heroStats.data ?? []).map((h) => [h.id, h])), [heroStats.data])
  const teamMap = useMemo(() => new Map((teams.data ?? []).map((t) => [t.team_id, t])), [teams.data])

  if (!Number.isInteger(id) || id <= 0) {
    return <div className="py-16 text-center text-[14px]" style={{ color: '#8a8474' }}>Invalid league id.</div>
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1
          className="text-[36px] leading-tight font-bold uppercase"
          style={{ color: '#e8e2d4', fontFamily: 'var(--font-display)', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          {league?.name ?? (leagues.isPending ? 'Loading...' : `League ${id}`)}
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.15em]"
          style={{ color: '#fff', fontFamily: 'var(--font-dota)', textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          {summary.data
            ? `${summary.data.total_matches.toLocaleString()} matches${
                summary.data.first_match
                  ? ` · ${formatTimeAgo(summary.data.first_match)} to ${formatTimeAgo(summary.data.last_match ?? summary.data.first_match)}`
                  : ''
              }`
            : 'Loading match history...'}
        </p>
      </div>

      {summary.data && summary.data.total_matches === 0 ? (
        <div>
          <div className="py-8 text-center text-[14px]" style={{ color: '#8a8474' }}>
            {relatedLeagues.length > 0
              ? "This event hasn't been played yet, no matches recorded."
              : 'OpenDota has no recorded matches for this league.'}
          </div>
          {relatedLeagues.length > 0 && (
            <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
              <div
                className="px-4 py-3 text-[13px] uppercase tracking-[0.15em]"
                style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)', borderBottom: '1px solid #24222a' }}
              >
                Qualifiers and related events
              </div>
              {relatedLeagues.map((l, i) => (
                <a
                  key={l.leagueid}
                  href={`/league/${l.leagueid}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
                  style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                >
                  <span className="flex-1 truncate text-[15px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                    {l.subName}
                  </span>
                  {l.tier && (
                    <span
                      className="shrink-0 px-2 py-0.5 text-[12px] uppercase"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#8a8474', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
                    >
                      {TIER_LABELS[l.tier] ?? l.tier}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            className="flex items-center flex-wrap gap-1 mb-4 px-1 py-1"
            style={{ fontFamily: 'var(--font-dota)', background: 'rgba(8,10,12,0.55)', border: '1px solid #24222a' }}
          >
            {LEAGUE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-4 py-2 text-[14px] font-semibold uppercase cursor-pointer whitespace-nowrap"
                style={{
                  color: tab === t.key ? '#0b0b0d' : '#a8a294',
                  background: tab === t.key ? '#c9a94a' : 'transparent',
                  letterSpacing: '2px',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'standings' && <StandingsPanel leagueId={id} teamMap={teamMap} />}
          {tab === 'results' && <SeriesPanel leagueId={id} teamMap={teamMap} />}
          {tab === 'draft' && <DraftPanel leagueId={id} heroMap={heroMap} />}
          {tab === 'participants' && <RosterPanel leagueId={id} teamMap={teamMap} />}
        </div>
      )}
    </div>
  )
}
