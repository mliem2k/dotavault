import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AllMatches } from '@/components/player/all_matches'
import { HeroStatsTable } from '@/components/player/hero_stats_table'
import { PlayerStats } from '@/components/player/player_stats'
import { Teammates } from '@/components/player/teammates'
import { LifetimeStats, PlayStyleRadar } from '@/components/player/play_style_radar'
import { RecentGames } from '@/components/player/recent_games'
import { Spinner } from '@/components/ui/spinner'
import { DIVISIONS, findLeaderboardPosition } from '@/lib/leaderboard'
import { opendota } from '@/lib/opendota'
import { RANK_NAMES, rankBadge, rankName } from '@/lib/rank'
import { resolveVanitySteamId } from '@/lib/steam'
import { usePageTitle } from '@/lib/title'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug, winRate } from '@/lib/utils'

export const Route = createFileRoute('/player/$accountId')({
  component: PlayerPage,
})

// Client palette shared with the match screens.
const C = {
  label: '#67757f',
  labelBright: '#8a97a0',
  text: '#cfd4d8',
  white: '#ffffff',
  gold: '#cb9b25',
  green: '#8fbf3f',
  panel: 'rgba(16,19,22,0.72)',
}

const PROFILE_TABS = ['Profile', 'Matches', 'Stats'] as const
const FEED_TABS = ['Recent Games', 'Teammates']

function PlayerPage() {
  const { accountId } = Route.useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof PROFILE_TABS)[number]>('Profile')
  const [feedTab, setFeedTab] = useState<'Recent Games' | 'Teammates'>('Recent Games')

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
      const [player, wl] = await Promise.all([opendota.player(accountId), opendota.playerWL(accountId)])
      return { player, wl }
    },
    enabled: isNumeric,
  })
  const matches = useQuery({
    queryKey: ['player_matches', accountId],
    queryFn: () => opendota.playerMatches(accountId, { limit: 40 }),
    enabled: isNumeric,
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
    enabled: isNumeric && feedTab === 'Teammates',
  })
  const countsQ = useQuery({
    queryKey: ['player_counts', accountId],
    queryFn: () => opendota.playerCounts(accountId),
    staleTime: 10 * 60 * 1000,
    enabled: isNumeric && tab === 'Stats',
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
  const personaName = player.data?.player.profile.personaname
  const proNameForAccount = proPlayers.data?.find((pp) => pp.account_id === Number(accountId) && pp.is_pro)?.name
  const leaderboardPos = useQuery({
    queryKey: ['leaderboard_position', accountId, personaName, proNameForAccount],
    queryFn: () => findLeaderboardPosition([personaName, proNameForAccount].filter((n): n is string => !!n)),
    enabled: isImmortal && !!personaName,
    staleTime: 30 * 60 * 1000,
  })

  usePageTitle(player.data?.player.profile.personaname)

  if (!isNumeric) {
    if (vanity.isPending || vanity.data) {
      return (
        <div className="flex flex-col items-center gap-3 py-20">
          <Spinner className="h-8 w-8" />
          <span className="text-sm" style={{ color: C.labelBright }}>Resolving Steam profile…</span>
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
  if (!player.data) return <div className="text-sm text-muted">Player not found.</div>

  const p = player.data.player
  const wl = player.data.wl
  const totalGames = wl.win + wl.lose
  const proInfo = proPlayers.data?.find((pp) => pp.account_id === Number(accountId) && pp.is_pro)
  const badge = rankBadge(p.rank_tier)
  const heroesPlayed = (playerHeroes.data ?? []).filter((h) => h.games > 0).length
  const heroMap = new Map((heroStats.data ?? []).map((h) => [h.id, h]))
  const featured = (playerHeroes.data ?? []).slice(0, 3)
  const lastMatchTime = matches.data?.[0]?.start_time
  const updatedStr = lastMatchTime
    ? new Date(lastMatchTime * 1000).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const bigStat = (label: string, value: string) => (
    <div>
      <div className="text-[12px] uppercase" style={{ color: C.label, letterSpacing: '2px' }}>{label}</div>
      <div className="text-[30px] leading-tight tabular-nums" style={{ color: C.white }}>{value}</div>
    </div>
  )

  return (
    <div className="flex flex-col gap-0" style={{ fontFamily: 'var(--font-dota)' }}>
      {/* Tab strip — PROFILE / STATS */}
      <div className="flex items-center mt-3 mb-3 px-3 py-2.5" style={{ background: 'rgba(8,10,12,0.55)' }}>
        {PROFILE_TABS.map((t, i) => (
          <span key={t} className="flex items-center">
            {i > 0 && <span className="mx-3 text-[15px]" style={{ color: '#3f464d' }}>/</span>}
            <button
              type="button"
              onClick={() => setTab(t)}
              className="text-[16px] font-semibold uppercase cursor-pointer"
              style={{
                color: t === tab ? '#ffffff' : '#7d8b95',
                letterSpacing: '3px',
                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                borderBottom: t === tab ? '1px solid #ffffff' : '1px solid transparent',
                paddingBottom: 2,
              }}
            >
              {t}
            </button>
          </span>
        ))}
      </div>

      {/* Header bar */}
      <div className="flex items-center gap-4 px-4 py-3" style={{ background: 'rgba(8,10,12,0.9)' }}>
        <img
          src={p.profile.avatarfull}
          alt={p.profile.personaname}
          className="h-16 w-16 shrink-0"
          style={{ border: '1px solid #2c3236' }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[28px] leading-tight truncate" style={{ color: C.white }}>
              {p.profile.personaname}
            </h1>
            {proInfo?.name && proInfo.name !== p.profile.personaname && (
              <span className="text-[15px]" style={{ color: C.labelBright }}>
                [{proInfo.name}]
              </span>
            )}
            {proInfo?.team_id && (
              <a
                href={`/team/${proInfo.team_id}`}
                className="text-[13px] px-1.5 py-0.5 shrink-0 hover:brightness-125"
                style={{ background: '#24222a', color: '#c9a94a' }}
                title={proInfo.team_name ?? undefined}
              >
                {proInfo.team_tag ?? proInfo.team_name}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 text-[13px] uppercase" style={{ color: C.green, letterSpacing: '2px' }}>
            {rankName(p.rank_tier)}
            {leaderboardPos.data && (
              <span
                className="px-1.5 py-0.5 text-[12px]"
                style={{ background: '#2a2410', color: '#f2c94c', letterSpacing: '1px' }}
                title={`Rank #${leaderboardPos.data.rank} on Valve's ${DIVISIONS.find((d) => d.id === leaderboardPos.data?.division)?.label} leaderboard`}
              >
                #{leaderboardPos.data.rank}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-10 ml-auto pr-2">
          {bigStat('Matches', totalGames.toLocaleString())}
          {bigStat('Win Rate', winRate(wl.win, totalGames))}
          <div className="flex flex-col items-end">
            <div className="text-[12px] uppercase" style={{ color: C.label, letterSpacing: '1px' }}>
              Friend ID: <span className="tabular-nums" style={{ color: C.white }}>{p.profile.account_id}</span>
            </div>
          </div>
        </div>
      </div>

      {tab === 'Matches' && (
        <div className="mt-3">
          {heroStats.isPending ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : heroStats.data ? (
            <AllMatches accountId={accountId} heroStats={heroStats.data} />
          ) : null}
        </div>
      )}

      {tab === 'Stats' && (
        <div className="mt-3 space-y-4">
          {totals.isPending || countsQ.isPending ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : totals.data ? (
            <PlayerStats totals={totals.data} counts={countsQ.data} wl={wl} />
          ) : null}
          <div style={{ background: C.panel }}>
            <div
              className="text-[15px] uppercase px-4 py-3"
              style={{ color: C.white, letterSpacing: '2px', background: 'rgba(8,10,12,0.7)' }}
            >
              Most Played Heroes
            </div>
            <div className="p-4">
              {playerHeroes.isPending || heroStats.isPending ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : playerHeroes.data && heroStats.data ? (
                <HeroStatsTable playerHeroes={playerHeroes.data} heroStats={heroStats.data} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {tab === 'Profile' && (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,46%)_1fr] gap-4 mt-3">
        {/* ---- Left column ---- */}
        <div className="space-y-3 min-w-0">
          {/* Featured heroes + rank emblem */}
          <div className="flex items-center gap-3 px-3 py-3" style={{ background: C.panel }}>
            <div className="flex gap-2 flex-1 min-w-0">
              {featured.map((ph) => {
                const hero = heroMap.get(Number(ph.hero_id))
                if (!hero) return null
                return (
                  <a key={ph.hero_id} href={`/hero/${heroSlug(hero.localized_name)}`} className="shrink-0 hover:brightness-125">
                    <img
                      src={heroLandscapeUrl(hero.name)}
                      alt={hero.localized_name}
                      title={`${hero.localized_name} · ${ph.games} games`}
                      style={{ width: 118, height: 66, objectFit: 'cover', border: '1px solid #2c3236' }}
                      onError={cdnFallback(heroLandscapeCdn(hero.name))}
                    />
                  </a>
                )
              })}
            </div>
            {badge && (
              <div className="relative group shrink-0">
                <div
                  className="relative flex items-center justify-center rounded-full cursor-default"
                  style={{
                    width: 84,
                    height: 84,
                    background: leaderboardPos.data
                      ? 'radial-gradient(circle, #3a2f10 0%, #101316 70%)'
                      : 'radial-gradient(circle, #23282c 0%, #101316 70%)',
                    border: `2px solid ${leaderboardPos.data ? '#f2c94c' : '#2c3236'}`,
                  }}
                >
                  <img src={badge.medal} alt={rankName(p.rank_tier)} className="h-16 w-16 object-contain" />
                  {badge.stars && <img src={badge.stars} alt="" className="absolute h-16 w-16 object-contain" />}
                  {leaderboardPos.data && (
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[12px] font-bold tabular-nums"
                      style={{ background: '#f2c94c', color: '#1a1608', letterSpacing: '0.5px' }}
                    >
                      #{leaderboardPos.data.rank}
                    </span>
                  )}
                </div>
                {/* Rank ladder tooltip: all tiers, current one highlighted */}
                <div
                  className="absolute right-0 top-full mt-2 hidden group-hover:block z-50 pointer-events-none"
                  style={{
                    background: 'rgba(10,13,15,0.97)',
                    border: '1px solid #3a4147',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.75)',
                    padding: '12px 14px',
                    width: 460,
                  }}
                >
                  <div className="text-[12px] uppercase mb-2" style={{ color: C.labelBright, letterSpacing: '2px' }}>
                    Rank Tiers
                  </div>
                  <div className="flex justify-between">
                    {RANK_NAMES.slice(1).map((name, i) => {
                      const tier = i + 1
                      const current = Math.floor((p.rank_tier ?? 0) / 10) === tier
                      return (
                        <div key={name} className="flex flex-col items-center" style={{ width: 52, opacity: current ? 1 : 0.45 }}>
                          <div
                            className="relative flex items-center justify-center rounded-full"
                            style={{
                              width: 48,
                              height: 48,
                              border: current ? '2px solid rgba(255,255,255,0.8)' : '2px solid transparent',
                            }}
                          >
                            <img src={`/ranks/rank_icon_${tier}.webp`} alt={name} className="h-11 w-11 object-contain" />
                            {current && badge.stars && (
                              <img src={badge.stars} alt="" className="absolute h-11 w-11 object-contain" />
                            )}
                          </div>
                          <span
                            className="mt-1 text-[10px] uppercase text-center"
                            style={{ color: current ? C.white : C.label, letterSpacing: '0.5px' }}
                          >
                            {name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Play style + lifetime stats */}
          <div style={{ background: C.panel }}>
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px' }}>Play Style</span>
            </div>
            <div className="flex items-start justify-between px-4 pt-1 pb-4 gap-6 flex-wrap">
              <div className="min-w-[240px] flex-1">
                <div className="text-[11px] uppercase mb-1" style={{ color: C.gold, letterSpacing: '1px' }}>
                  Lifetime Stats Shown
                </div>
                {totals.isPending ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : totals.data ? (
                  <PlayStyleRadar totals={totals.data} heroesPlayed={heroesPlayed} />
                ) : (
                  <p className="text-sm" style={{ color: C.label }}>No stats available.</p>
                )}
              </div>
              <div className="shrink-0 pt-6">
                <div className="text-[12px] uppercase mb-2" style={{ color: C.labelBright, letterSpacing: '2px' }}>
                  Lifetime Stats
                </div>
                {totals.data && <LifetimeStats totals={totals.data} />}
              </div>
            </div>
            {/* Legend strip */}
            <div className="flex items-center justify-end gap-2 px-3 py-1.5" style={{ background: 'rgba(8,10,12,0.8)' }}>
              <span className="inline-block" style={{ width: 10, height: 10, background: '#d78f28' }} />
              <span className="text-[12px]" style={{ color: C.text }}>{p.profile.personaname}</span>
            </div>
          </div>
        </div>

        {/* ---- Right column ---- */}
        <div className="min-w-0">
          {/* Feed tabs */}
          <div className="flex items-center pb-2 pl-1">
            {FEED_TABS.map((t, i) => (
              <span key={t} className="flex items-center">
                {i > 0 && <span className="mx-2.5 text-[13px]" style={{ color: '#3f464d' }}>/</span>}
                <button
                  type="button"
                  onClick={() => setFeedTab(t as 'Recent Games' | 'Teammates')}
                  className="text-[13px] uppercase cursor-pointer"
                  style={{
                    color: t === feedTab ? '#ffffff' : '#7d8b95',
                    letterSpacing: '2px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                  }}
                >
                  {t}
                </button>
              </span>
            ))}
          </div>

          {feedTab === 'Recent Games' &&
            (matches.isPending || heroStats.isPending ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : matches.data && heroStats.data ? (
              <RecentGames matches={matches.data} heroStats={heroStats.data} />
            ) : null)}
          {feedTab === 'Teammates' &&
            (peers.isPending ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : peers.data ? (
              <Teammates peers={peers.data} />
            ) : null)}
        </div>
      </div>
      )}
    </div>
  )
}
