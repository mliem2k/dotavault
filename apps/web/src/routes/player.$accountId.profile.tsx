import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { LifetimeStats, PlayStyleRadar } from '@/components/player/play_style_radar'
import { Spinner } from '@/components/ui/spinner'
import { divisionLabel, divisionShort } from '@/lib/leaderboard'
import { usePlayerData } from '@/lib/player_data_context'
import { RANK_NAMES, rankName } from '@/lib/rank'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

const C = {
  label: 'var(--color-slate-muted)',
  labelBright: 'var(--color-slate-muted-light)',
  text: 'var(--color-slate-foreground)',
  white: 'var(--color-white)',
  gold: 'var(--color-gold)',
  panel: 'rgba(16,19,22,0.72)',
}

export const Route = createFileRoute('/player/$accountId/profile')({
  component: ProfileLayout,
})

function ProfileLayout() {
  const { accountId, p, badge, heroesPlayed, heroMap, featured, leaderboardPos, totals } =
    usePlayerData()
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
                <a
                  key={ph.hero_id}
                  href={`/hero/${heroSlug(hero.localized_name)}`}
                  className="shrink-0 hover:brightness-125"
                >
                  <img
                    src={heroLandscapeUrl(hero.name)}
                    alt={hero.localized_name}
                    title={`${hero.localized_name} · ${ph.games} games`}
                    className="border border-slate-card"
                    style={{ width: 118, height: 66, objectFit: 'cover' }}
                    onError={cdnFallback(heroLandscapeCdn(hero.name))}
                  />
                </a>
              )
            })}
          </div>
          {badge && (
            <div className="relative group shrink-0" tabIndex={0}>
              <div
                className="relative flex items-center justify-center rounded-full cursor-default"
                style={{
                  width: 84,
                  height: 84,
                  // Gradient stops (#3a2f10, #101316, #23282c) are not in the Token
                  // Mapping Reference — left as-is per task instructions.
                  background: leaderboardPos.data
                    ? 'radial-gradient(circle, #3a2f10 0%, #101316 70%)'
                    : 'radial-gradient(circle, #23282c 0%, #101316 70%)',
                  border: `2px solid ${leaderboardPos.data ? 'var(--color-gold)' : 'var(--color-slate-card)'}`,
                }}
              >
                <img
                  src={badge.medal}
                  alt={rankName(p.rank_tier)}
                  className="h-16 w-16 object-contain"
                />
                {badge.stars && (
                  <img src={badge.stars} alt="" className="absolute h-16 w-16 object-contain" />
                )}
                {leaderboardPos.data && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[12px] font-bold tabular-nums whitespace-nowrap bg-gold"
                    // #1a1608 is not in the Token Mapping Reference — left as-is per
                    // task instructions.
                    style={{ color: '#1a1608', letterSpacing: '0.5px' }}
                    title={`Rank #${leaderboardPos.data.rank} on Valve's ${divisionLabel(leaderboardPos.data.division)} leaderboard`}
                  >
                    #{leaderboardPos.data.rank} {divisionShort(leaderboardPos.data.division)}
                  </span>
                )}
              </div>
              {/* Rank ladder tooltip: all tiers, current one highlighted */}
              <div
                className="absolute right-0 top-full mt-2 hidden group-hover:block group-focus-within:block z-50 pointer-events-none border border-slate-border"
                style={{
                  background: 'rgba(10,13,15,0.97)',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.75)',
                  padding: '12px 14px',
                  width: 460,
                }}
              >
                <div
                  className="text-[12px] uppercase mb-2"
                  style={{ color: C.labelBright, letterSpacing: '2px' }}
                >
                  Rank Tiers
                </div>
                <div className="flex justify-between">
                  {RANK_NAMES.slice(1).map((name, i) => {
                    const tier = i + 1
                    const current = Math.floor((p.rank_tier ?? 0) / 10) === tier
                    return (
                      <div
                        key={name}
                        className="flex flex-col items-center"
                        style={{ width: 52, opacity: current ? 1 : 0.45 }}
                      >
                        <div
                          className="relative flex items-center justify-center rounded-full"
                          style={{
                            width: 48,
                            height: 48,
                            border: current
                              ? '2px solid rgba(255,255,255,0.8)'
                              : '2px solid transparent',
                          }}
                        >
                          <img
                            src={`/ranks/rank_icon_${tier}.webp`}
                            alt={name}
                            className="h-11 w-11 object-contain"
                          />
                          {current && badge.stars && (
                            <img
                              src={badge.stars}
                              alt=""
                              className="absolute h-11 w-11 object-contain"
                            />
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
            <span
              className="text-[15px] uppercase"
              style={{ color: C.white, letterSpacing: '2px' }}
            >
              Play Style
            </span>
          </div>
          <div className="flex items-start justify-between px-4 pt-1 pb-4 gap-6 flex-wrap">
            <div className="min-w-[240px] flex-1">
              <div
                className="text-[11px] uppercase mb-1"
                style={{ color: C.gold, letterSpacing: '1px' }}
              >
                Lifetime Stats Shown
              </div>
              {totals.isPending ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : totals.data ? (
                <PlayStyleRadar totals={totals.data} heroesPlayed={heroesPlayed} />
              ) : (
                <p className="text-sm" style={{ color: C.label }}>
                  No stats available.
                </p>
              )}
            </div>
            <div className="shrink-0 pt-6">
              <div
                className="text-[12px] uppercase mb-2"
                style={{ color: C.labelBright, letterSpacing: '2px' }}
              >
                Lifetime Stats
              </div>
              {totals.data && <LifetimeStats totals={totals.data} />}
            </div>
          </div>
          {/* Legend strip */}
          <div
            className="flex items-center justify-end gap-2 px-3 py-1.5"
            style={{ background: 'rgba(8,10,12,0.8)' }}
          >
            <span className="inline-block bg-gold" style={{ width: 10, height: 10 }} />
            <span className="text-[12px]" style={{ color: C.text }}>
              {p.profile.personaname}
            </span>
          </div>
        </div>
      </div>

      {/* ---- Right column ---- */}
      <div className="min-w-0">
        {/* Feed tabs — DESIGN.md tab-active/tab-inactive: gold fill vs muted/transparent */}
        <div className="flex items-center gap-1 pb-2">
          <Link
            to="/player/$accountId/profile/$feed"
            params={{ accountId, feed: 'recent' }}
            className={`inline-flex items-center justify-center min-h-[44px] text-[12px] uppercase transition-colors px-3 ${
              activeFeed === 'recent' ? '' : 'hover:bg-white/[0.03] hover:text-foreground'
            }`}
            style={{
              background: activeFeed === 'recent' ? 'var(--color-gold)' : 'transparent',
              color: activeFeed === 'recent' ? 'var(--color-background)' : 'var(--color-muted)',
              letterSpacing: '1.5px',
            }}
          >
            Recent Games
          </Link>
          <Link
            to="/player/$accountId/profile/$feed"
            params={{ accountId, feed: 'teammates' }}
            className={`inline-flex items-center justify-center min-h-[44px] text-[12px] uppercase transition-colors px-3 ${
              activeFeed === 'teammates' ? '' : 'hover:bg-white/[0.03] hover:text-foreground'
            }`}
            style={{
              background: activeFeed === 'teammates' ? 'var(--color-gold)' : 'transparent',
              color: activeFeed === 'teammates' ? 'var(--color-background)' : 'var(--color-muted)',
              letterSpacing: '1.5px',
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
