import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { LifetimeStats, PlayStyleRadar } from '@/components/player/play_style_radar'
import { RecentGames } from '@/components/player/recent_games'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, winRate } from '@/lib/utils'

export const Route = createFileRoute('/player/$accountId')({
  component: PlayerPage,
})

const RANK_NAMES = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']

function rankName(rankTier: number | null): string {
  if (!rankTier) return 'Unranked'
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier === 8) return 'Immortal'
  return `${RANK_NAMES[tier] ?? 'Unknown'}${stars ? ` ${stars}` : ''}`
}

function rankBadge(rankTier: number | null): { medal: string; stars: string | null } | null {
  if (!rankTier) return null
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier < 1 || tier > 8) return null
  return {
    medal: `/ranks/rank_icon_${tier}.webp`,
    stars: tier < 8 && stars > 0 ? `/ranks/rank_star_${stars}.webp` : null,
  }
}

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

const PROFILE_TABS = ['Profile', 'Trophies', 'Tickets', 'Stats']
const FEED_TABS = ['Activity Feed', 'Recent Games', 'All-Hero Challenge', 'Teammates']

function PlayerPage() {
  const { accountId } = Route.useParams()
  const [feedTab] = useState('Recent Games')

  const player = useQuery({
    queryKey: ['player', accountId],
    queryFn: async () => {
      const [player, wl] = await Promise.all([opendota.player(accountId), opendota.playerWL(accountId)])
      return { player, wl }
    },
  })
  const matches = useQuery({
    queryKey: ['player_matches', accountId],
    queryFn: () => opendota.playerMatches(accountId, 40),
  })
  const playerHeroes = useQuery({
    queryKey: ['player_heroes', accountId],
    queryFn: () => opendota.playerHeroes(accountId),
  })
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const totals = useQuery({
    queryKey: ['player_totals', accountId],
    queryFn: () => opendota.playerTotals(accountId),
    staleTime: 10 * 60 * 1000,
  })

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
      {/* Tab strip — PROFILE / TROPHIES / TICKETS / STATS */}
      <div className="flex items-center pt-4 pb-3 pl-2">
        {PROFILE_TABS.map((t, i) => (
          <span key={t} className="flex items-center">
            {i > 0 && <span className="mx-3 text-[15px]" style={{ color: '#3f464d' }}>/</span>}
            <span
              className="text-[16px] font-semibold uppercase"
              style={{
                color: t === 'Profile' ? '#ffffff' : '#67757f',
                letterSpacing: '3px',
                borderBottom: t === 'Profile' ? '1px solid #ffffff' : '1px solid transparent',
                paddingBottom: 2,
                cursor: t === 'Profile' ? 'default' : 'not-allowed',
                opacity: t === 'Profile' ? 1 : 0.8,
              }}
              title={t === 'Profile' ? undefined : 'Not available'}
            >
              {t}
            </span>
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
          <h1 className="text-[28px] leading-tight truncate" style={{ color: C.white }}>
            {p.profile.personaname}
          </h1>
          <div className="text-[13px] uppercase" style={{ color: C.green, letterSpacing: '2px' }}>
            {rankName(p.rank_tier)}
          </div>
        </div>

        <div className="flex items-center gap-10 ml-auto pr-2">
          {bigStat('Matches', totalGames.toLocaleString())}
          {bigStat('Win Rate', winRate(wl.win, totalGames))}
          <div className="flex flex-col items-end gap-1.5">
            <span
              className="px-4 py-1.5 text-[12px] uppercase"
              style={{ background: '#2c3236', color: C.text, letterSpacing: '1px', opacity: 0.7, cursor: 'not-allowed' }}
              title="Not available"
            >
              ✎ Edit Profile
            </span>
            <div className="text-[12px] uppercase" style={{ color: C.label, letterSpacing: '1px' }}>
              Friend ID: <span className="tabular-nums" style={{ color: C.white }}>{p.profile.account_id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,46%)_1fr] gap-4 mt-3">
        {/* ---- Left column ---- */}
        <div className="space-y-3 min-w-0">
          {/* Featured heroes + rank emblem */}
          <div className="flex items-center gap-3 px-3 py-3" style={{ background: C.panel }}>
            <div className="flex gap-2 flex-1 min-w-0">
              {featured.map((ph) => {
                const hero = heroMap.get(Number(ph.hero_id))
                if (!hero) return null
                const short = hero.name.replace('npc_dota_hero_', '')
                return (
                  <a key={ph.hero_id} href={`/hero/${short}`} className="shrink-0 hover:brightness-125">
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
              <div
                className="relative shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 84, height: 84, background: 'radial-gradient(circle, #23282c 0%, #101316 70%)', border: '2px solid #2c3236' }}
              >
                <img src={badge.medal} alt={rankName(p.rank_tier)} className="h-16 w-16 object-contain" />
                {badge.stars && <img src={badge.stars} alt="" className="absolute h-16 w-16 object-contain" />}
              </div>
            )}
          </div>

          {/* Conduct summary bar */}
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: C.panel }}>
            <span className="text-[13px] uppercase" style={{ color: C.white, letterSpacing: '1px' }}>
              Conduct Summary
            </span>
            {updatedStr && (
              <span className="text-[12px]" style={{ color: C.label }}>Updated {updatedStr}</span>
            )}
            <span
              className="ml-auto px-4 py-1 text-[12px]"
              style={{ background: '#3a4147', color: C.text, opacity: 0.7, cursor: 'not-allowed' }}
              title="Not available"
            >
              Show Summary
            </span>
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
                <span
                  className="text-[13px] uppercase"
                  style={{
                    color: t === feedTab ? '#ffffff' : '#67757f',
                    letterSpacing: '2px',
                    cursor: t === feedTab ? 'default' : 'not-allowed',
                  }}
                  title={t === feedTab ? undefined : 'Not available'}
                >
                  {t}
                </span>
              </span>
            ))}
          </div>

          {matches.isPending || heroStats.isPending ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : matches.data && heroStats.data ? (
            <RecentGames matches={matches.data} heroStats={heroStats.data} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
