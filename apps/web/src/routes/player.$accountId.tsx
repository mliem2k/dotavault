import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { divisionLabel, divisionShort, findLeaderboardPosition } from '@/lib/leaderboard'
import { opendota } from '@/lib/opendota'
import { PlayerDataContext } from '@/lib/player_data_context'
import { rankBadge, rankName } from '@/lib/rank'
import { fetchSteamProfile, resolveVanitySteamId } from '@/lib/steam'
import { usePageTitle } from '@/lib/title'
import { winRate } from '@/lib/utils'

export const Route = createFileRoute('/player/$accountId')({
  component: PlayerPage,
})

// Client palette shared with the match screens.
// #8fbf3f (green) is not in the Token Mapping Reference (distinct "won" green
// used across the slate-family pages) — left as-is per task instructions.
const C = {
  label: 'var(--color-muted)',
  labelBright: 'var(--color-slate-muted-light)',
  text: 'var(--color-slate-foreground)',
  white: 'var(--color-white)',
  gold: 'var(--color-gold)',
  green: '#8fbf3f',
  panel: 'rgba(16,19,22,0.72)',
}

function PlayerPage() {
  const { accountId } = Route.useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = pathname.includes('/matches')
    ? 'matches'
    : pathname.includes('/stats')
      ? 'stats'
      : 'profile'
  const activeFeed = pathname.endsWith('/teammates') ? 'teammates' : 'recent'

  // /player/mliem etc: the id in the URL is a Steam vanity slug, not a
  // numeric Dota account_id. Resolve it via Steam, then replace the URL with
  // the canonical numeric one instead of querying OpenDota with garbage.
  const isNumeric = /^\d+$/.test(accountId)
  const vanity = useQuery({
    queryKey: ['steam_vanity', accountId],
    queryFn: () => resolveVanitySteamId(accountId),
    enabled: !isNumeric,
  })

  useEffect(() => {
    if (vanity.data) {
      navigate({ to: '/player/$accountId', params: { accountId: vanity.data }, replace: true })
    }
  }, [vanity.data, navigate])

  const player = useQuery({
    queryKey: ['player', accountId],
    queryFn: async () => {
      const [player, wl] = await Promise.all([
        opendota.player(accountId),
        opendota.playerWL(accountId),
      ])
      return { player, wl }
    },
    enabled: isNumeric,
  })
  // OpenDota only has a persona name/avatar once something has triggered it
  // to resolve and cache that account's Steam profile, which can lag well
  // behind this page load (or never happen at all for an account nobody's
  // individually visited before), leaving `profile` null. Steam's own basic
  // profile identity is public regardless of privacy settings, so fall back
  // to it directly via the same playerdb.co proxy already used for vanity
  // resolution, rather than showing a crash or an empty header while waiting
  // on OpenDota's cache.
  const hasOpenDotaProfile = player.data?.player.profile != null
  const steamFallback = useQuery({
    queryKey: ['steam_profile_fallback', accountId],
    queryFn: () => fetchSteamProfile(Number(accountId)),
    enabled: isNumeric && player.data != null && !hasOpenDotaProfile,
    staleTime: 60 * 60 * 1000,
  })
  const matches = useQuery({
    queryKey: ['player_matches', accountId],
    queryFn: () => opendota.playerMatches(accountId, { limit: 40 }),
    enabled: isNumeric,
  })
  const matchesLeagueInfo = useQuery({
    queryKey: ['player_matches_league_info', accountId, matches.data?.map((m) => m.match_id)],
    queryFn: () => opendota.matchesLeagueInfo(matches.data!.map((m) => m.match_id)),
    enabled: isNumeric && !!matches.data && matches.data.length > 0,
    staleTime: 10 * 60 * 1000,
  })
  const playerHeroes = useQuery({
    queryKey: ['player_heroes', accountId],
    queryFn: () => opendota.playerHeroes(accountId),
    enabled: isNumeric,
  })
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const totals = useQuery({
    queryKey: ['player_totals', accountId],
    queryFn: () => opendota.playerTotals(accountId),
    staleTime: 10 * 60 * 1000,
    enabled: isNumeric,
  })
  const peers = useQuery({
    queryKey: ['player_peers', accountId],
    queryFn: () => opendota.playerPeers(accountId),
    staleTime: 10 * 60 * 1000,
    enabled: isNumeric && activeFeed === 'teammates',
  })
  const countsQ = useQuery({
    queryKey: ['player_counts', accountId],
    queryFn: () => opendota.playerCounts(accountId),
    staleTime: 10 * 60 * 1000,
    enabled: isNumeric && activeTab === 'stats',
  })
  // Small, slow-changing roster — shared cache with the Pro page if visited.
  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 60 * 60 * 1000,
    enabled: isNumeric,
  })

  // Immortal-tier players may be on Valve's live top-5000 leaderboard;
  // OpenDota's own rank_tier field doesn't carry that distinction (only its
  // separate, often-stale leaderboard_rank field does), so we check Valve's
  // real leaderboard directly, same source and matching rule as our own
  // /leaderboards page.
  const rankTier = player.data?.player.rank_tier ?? null
  const isImmortal = rankTier != null && Math.floor(rankTier / 10) === 8
  const personaName = player.data?.player.profile?.personaname ?? steamFallback.data?.personaname
  const proNameForAccount = proPlayers.data?.find(
    (pp) => pp.account_id === Number(accountId) && pp.is_pro,
  )?.name
  const leaderboardPos = useQuery({
    queryKey: ['leaderboard_position', accountId, personaName, proNameForAccount],
    queryFn: () =>
      findLeaderboardPosition([personaName, proNameForAccount].filter((n): n is string => !!n)),
    enabled: isImmortal && !!personaName,
    staleTime: 30 * 60 * 1000,
  })

  usePageTitle(personaName)

  if (!isNumeric) {
    if (vanity.isPending || vanity.data) {
      return (
        <div className="flex flex-col items-center gap-3 py-20">
          <Spinner className="h-8 w-8" />
          <span className="text-sm" style={{ color: C.labelBright }}>
            Resolving Steam profile…
          </span>
        </div>
      )
    }
    return (
      <div className="text-sm text-muted py-20 text-center">
        Could not resolve "{accountId}" to a Steam profile.
      </div>
    )
  }

  if (player.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (player.isError) {
    return (
      <div className="text-sm text-muted py-20 text-center">
        Couldn't load this player right now (OpenDota may be rate-limited).{' '}
        <button
          type="button"
          onClick={() => player.refetch()}
          className="underline text-gold cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }
  if (!player.data) return <div className="text-sm text-muted">Player not found.</div>

  const openDotaProfile = player.data.player.profile
  if (!openDotaProfile && steamFallback.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Spinner className="h-8 w-8" />
        <span className="text-sm" style={{ color: C.labelBright }}>
          Resolving Steam profile…
        </span>
      </div>
    )
  }
  const resolvedProfile = openDotaProfile
    ? {
        personaname: openDotaProfile.personaname,
        avatarfull: openDotaProfile.avatarfull,
        account_id: openDotaProfile.account_id,
        isPrivate: false,
      }
    : steamFallback.data
      ? {
          personaname: steamFallback.data.personaname,
          avatarfull: steamFallback.data.avatarfull,
          account_id: Number(accountId),
          isPrivate: !steamFallback.data.isPublic,
        }
      : null
  if (!resolvedProfile) return <div className="text-sm text-muted">Player not found.</div>

  const p = {
    ...player.data.player,
    profile: { personaname: resolvedProfile.personaname, account_id: resolvedProfile.account_id },
  }
  const wl = player.data.wl
  const totalGames = wl.win + wl.lose
  const proInfo = proPlayers.data?.find((pp) => pp.account_id === Number(accountId) && pp.is_pro)
  // Most recent name first, current persona name excluded, deduplicated
  // (Steam lets a name repeat across separate name-change events).
  const previousNames = [
    ...new Set(
      (p.aliases ?? [])
        .filter((a) => a.personaname && a.personaname !== resolvedProfile.personaname)
        .sort((a, b) => new Date(b.name_since).getTime() - new Date(a.name_since).getTime())
        .map((a) => a.personaname),
    ),
  ]
  const badge = rankBadge(p.rank_tier)
  const heroesPlayed = (playerHeroes.data ?? []).filter((h) => h.games > 0).length
  const heroMap = new Map((heroStats.data ?? []).map((h) => [h.id, h]))
  const featured = (playerHeroes.data ?? []).slice(0, 3)

  const bigStat = (label: string, value: string) => (
    <div>
      <div className="text-[12px] uppercase" style={{ color: C.label, letterSpacing: '2px' }}>
        {label}
      </div>
      <div className="text-[30px] leading-tight tabular-nums" style={{ color: C.white }}>
        {value}
      </div>
    </div>
  )

  // DESIGN.md's tab-active/tab-inactive components: solid Aegis Gold fill +
  // near-black text when active, transparent + muted text otherwise.
  const tabLinkClass = (active: boolean) =>
    `inline-flex items-center justify-center min-h-[44px] text-[13px] font-semibold uppercase transition-colors px-4 ${
      active ? '' : 'hover:bg-white/[0.03] hover:text-foreground'
    }`
  const tabLinkStyle = (active: boolean) => ({
    background: active ? 'var(--color-gold)' : 'transparent',
    color: active ? 'var(--color-background)' : 'var(--color-muted)',
    letterSpacing: '1.5px',
  })

  return (
    <PlayerDataContext.Provider
      value={{
        accountId,
        p,
        wl,
        badge,
        heroesPlayed,
        heroMap,
        featured,
        leaderboardPos,
        heroStats,
        matches,
        matchesLeagueInfo,
        playerHeroes,
        totals,
        peers,
        countsQ,
      }}
    >
      <div className="flex flex-col gap-0 font-dota">
        {/* Tab strip — PROFILE / MATCHES / STATS */}
        <div
          className="flex items-center gap-1 flex-wrap mt-3 mb-3 px-3 py-2.5"
          style={{ background: 'rgba(8,10,12,0.55)' }}
        >
          <Link
            to="/player/$accountId/profile"
            params={{ accountId }}
            className={tabLinkClass(activeTab === 'profile')}
            style={tabLinkStyle(activeTab === 'profile')}
          >
            Profile
          </Link>
          <Link
            to="/player/$accountId/matches"
            params={{ accountId }}
            className={tabLinkClass(activeTab === 'matches')}
            style={tabLinkStyle(activeTab === 'matches')}
          >
            Matches
          </Link>
          <Link
            to="/player/$accountId/stats"
            params={{ accountId }}
            className={tabLinkClass(activeTab === 'stats')}
            style={tabLinkStyle(activeTab === 'stats')}
          >
            Stats
          </Link>
        </div>

        {/* Header bar */}
        <div
          className="flex items-center flex-wrap gap-4 px-4 py-3"
          style={{ background: 'rgba(8,10,12,0.9)' }}
        >
          <img
            src={resolvedProfile.avatarfull}
            alt={resolvedProfile.personaname}
            className="h-16 w-16 shrink-0 rounded-full border border-slate-card"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[28px] leading-tight truncate" style={{ color: C.white }}>
                {resolvedProfile.personaname}
              </h1>
              {resolvedProfile.isPrivate && (
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[12px] uppercase"
                  // #3a352a is not in the Token Mapping Reference (close to but distinct
                  // from #2a2620/#24222a border-border) — left as-is per task instructions.
                  style={{
                    color: C.labelBright,
                    border: '1px solid #3a352a',
                    letterSpacing: '1px',
                  }}
                >
                  Private
                </span>
              )}
              {proInfo?.name && proInfo.name !== resolvedProfile.personaname && (
                <span className="text-[15px]" style={{ color: C.labelBright }}>
                  [{proInfo.name}]
                </span>
              )}
              {proInfo?.team_id && (
                <a
                  href={`/team/${proInfo.team_id}`}
                  className="text-[13px] px-1.5 py-0.5 shrink-0 hover:brightness-125 bg-border text-gold"
                  title={proInfo.team_name ?? undefined}
                >
                  {proInfo.team_tag ?? proInfo.team_name}
                </a>
              )}
            </div>
            <div
              className="flex items-center gap-2 text-[13px] uppercase"
              style={{ color: C.green, letterSpacing: '2px' }}
            >
              {rankName(p.rank_tier)}
              {leaderboardPos.data && (
                <span
                  className="px-1.5 py-0.5 text-[12px] text-gold"
                  // #2a2410 is not in the Token Mapping Reference — left as-is per
                  // task instructions.
                  style={{ background: '#2a2410', letterSpacing: '1px' }}
                  title={`Rank #${leaderboardPos.data.rank} on Valve's ${divisionLabel(leaderboardPos.data.division)} leaderboard`}
                >
                  #{leaderboardPos.data.rank} {divisionShort(leaderboardPos.data.division)}
                </span>
              )}
            </div>
            {previousNames.length > 0 && (
              <div
                className="text-[12px] truncate"
                style={{ color: C.text }}
                title={previousNames.join(', ')}
              >
                Also known as: {previousNames.slice(0, 4).join(', ')}
                {previousNames.length > 4 ? ` +${previousNames.length - 4} more` : ''}
              </div>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-6 sm:gap-10 sm:ml-auto pr-2">
            {bigStat('Matches', totalGames.toLocaleString())}
            {bigStat('Win Rate', winRate(wl.win, totalGames))}
            <div className="flex flex-col items-end">
              <div
                className="text-[12px] uppercase"
                style={{ color: C.label, letterSpacing: '1px' }}
              >
                Friend ID:{' '}
                <span className="tabular-nums" style={{ color: C.white }}>
                  {p.profile.account_id}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Outlet />
      </div>
    </PlayerDataContext.Provider>
  )
}
