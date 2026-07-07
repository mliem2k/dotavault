import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { LifetimeStats, PlayStyleRadar } from '@/components/player/play_style_radar'
import { Spinner } from '@/components/ui/spinner'
import { divisionLabel, divisionShort } from '@/lib/leaderboard'
import { usePlayerData } from '@/lib/player_data_context'
import { RANK_NAMES, rankName } from '@/lib/rank'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

const C = {
  label: '#67757f',
  labelBright: '#8a97a0',
  text: '#cfd4d8',
  white: '#ffffff',
  gold: '#cb9b25',
  panel: 'rgba(16,19,22,0.72)',
}

export const Route = createFileRoute('/player/$accountId/profile')({
  component: ProfileLayout,
})

function ProfileLayout() {
  const { accountId, p, badge, heroesPlayed, heroMap, featured, leaderboardPos, totals } = usePlayerData()
  const { pathname } = useLocation()
  const activeFeed = pathname.endsWith('/teammates') ? 'teammates' : 'recent'

  return (
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
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[12px] font-bold tabular-nums whitespace-nowrap"
                    style={{ background: '#f2c94c', color: '#1a1608', letterSpacing: '0.5px' }}
                    title={`Rank #${leaderboardPos.data.rank} on Valve's ${divisionLabel(leaderboardPos.data.division)} leaderboard`}
                  >
                    #{leaderboardPos.data.rank} {divisionShort(leaderboardPos.data.division)}
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
          <Link
            to="/player/$accountId/profile/$feed"
            params={{ accountId, feed: 'recent' }}
            className="text-[13px] uppercase cursor-pointer"
            style={{
              color: activeFeed === 'recent' ? '#ffffff' : '#7d8b95',
              letterSpacing: '2px',
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            }}
          >
            Recent Games
          </Link>
          <span className="mx-2.5 text-[13px]" style={{ color: '#3f464d' }}>/</span>
          <Link
            to="/player/$accountId/profile/$feed"
            params={{ accountId, feed: 'teammates' }}
            className="text-[13px] uppercase cursor-pointer"
            style={{
              color: activeFeed === 'teammates' ? '#ffffff' : '#7d8b95',
              letterSpacing: '2px',
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            }}
          >
            Teammates
          </Link>
        </div>

        <Outlet />
      </div>
    </div>
  )
}
