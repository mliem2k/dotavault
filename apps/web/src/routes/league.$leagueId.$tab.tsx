import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { LeagueTabBar, type LeagueTab } from '@/components/league/league_tab_bar'
import { Panel } from '@/components/league/panel'
import { useTeamMap } from '@/components/league/use_team_map'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { fetchSteamProfile } from '@/lib/steam'
import { heroIconUrl } from '@/lib/utils'

type FallbackProfile = { name: string; avatar: string | null; isPrivate: boolean }

export const Route = createFileRoute('/league/$leagueId/$tab')({
  component: LeagueTabPage,
})

const VALID_TABS: LeagueTab[] = ['standings', 'draft', 'participants']

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

function StandingsPanel({ leagueId }: { leagueId: number }) {
  const standings = useQuery({
    queryKey: ['league_standings', leagueId],
    queryFn: () => opendota.leagueTeamStandings(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const navigate = useNavigate()
  const relevantTeamIds = useMemo(() => (standings.data ?? []).map((s) => s.team_id), [standings.data])
  const teamMap = useTeamMap(relevantTeamIds)

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

function RosterPanel({ leagueId }: { leagueId: number }) {
  const roster = useQuery({
    queryKey: ['league_roster', leagueId],
    queryFn: () => opendota.leagueRoster(leagueId),
    staleTime: 10 * 60 * 1000,
  })
  const relevantTeamIds = useMemo(() => (roster.data ?? []).map((r) => r.team_id), [roster.data])
  const teamMap = useTeamMap(relevantTeamIds)
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
  // they'd otherwise show as "Player <id>". Their individual OpenDota
  // profile usually has a personaname, but for an account OpenDota hasn't
  // resolved yet (it only fetches a Steam profile lazily, in the background,
  // sometime after first being asked about that account, not necessarily by
  // this request) that comes back empty too. Steam's own basic profile
  // identity (name, avatar) is public regardless of privacy settings, so
  // fall back to that directly instead of waiting on OpenDota's cache,
  // showing a "Private" badge when the account itself isn't public. Capped
  // so a huge open-qualifier bracket (dozens of teams, mostly unlisted
  // players) can't fire hundreds of individual requests at once; anyone past
  // the cap just keeps the "Player <id>" fallback.
  const missingIds = useMemo(() => {
    if (!roster.data) return []
    const ids = new Set<number>()
    for (const r of roster.data) if (!proMap.has(r.account_id)) ids.add(r.account_id)
    return [...ids].slice(0, 80)
  }, [roster.data, proMap])

  const fallbackProfiles = useQuery({
    queryKey: ['league_roster_fallback_profiles', leagueId, missingIds],
    queryFn: async () => {
      const entries = await Promise.all(
        missingIds.map(async (id): Promise<[number, FallbackProfile | null]> => {
          try {
            const p = await opendota.player(String(id))
            if (p.profile?.personaname) {
              return [id, { name: p.profile.personaname, avatar: p.profile.avatarfull ?? null, isPrivate: false }]
            }
          } catch {
            // fall through to the Steam lookup below
          }
          const steam = await fetchSteamProfile(id)
          if (steam) return [id, { name: steam.personaname, avatar: steam.avatarfull, isPrivate: !steam.isPublic }]
          return [id, null]
        }),
      )
      return new Map(entries.filter((e): e is [number, FallbackProfile] => e[1] != null))
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
                  const fallback = fallbackProfiles.data?.get(p.account_id)
                  const wr = p.games > 0 ? (p.wins / p.games) * 100 : 0
                  return (
                    <a
                      key={p.account_id}
                      href={`/player/${p.account_id}`}
                      className="flex items-center gap-2 py-0.5 hover:bg-white/[0.03]"
                    >
                      {!pro && fallback?.avatar && (
                        <img src={fallback.avatar} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: '#c8c2b4', fontFamily: 'var(--font-dota)' }}>
                        {pro?.name ?? pro?.personaname ?? fallback?.name ?? `Player ${p.account_id}`}
                      </span>
                      {!pro && fallback?.isPrivate && (
                        <span
                          className="shrink-0 px-1 text-[10px] uppercase"
                          style={{ color: '#8a8474', border: '1px solid #3a352a', letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
                        >
                          Private
                        </span>
                      )}
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

function LeagueTabPage() {
  const { leagueId, tab } = Route.useParams()
  const id = Number(leagueId)
  const activeTab = (VALID_TABS as string[]).includes(tab) ? (tab as LeagueTab) : 'standings'

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 60 * 60 * 1000,
  })
  const heroMap = useMemo(() => new Map((heroStats.data ?? []).map((h) => [h.id, h])), [heroStats.data])

  return (
    <div>
      <LeagueTabBar leagueId={leagueId} active={activeTab} />
      {activeTab === 'standings' && <StandingsPanel leagueId={id} />}
      {activeTab === 'draft' && <DraftPanel leagueId={id} heroMap={heroMap} />}
      {activeTab === 'participants' && <RosterPanel leagueId={id} />}
    </div>
  )
}
