import type { HeroStat, PickBan } from 'types'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

/* Draft tab — picks as full landscape cards, bans as struck-through
   grayscale thumbnails, one panel per team. */

const C = {
  dim: '#67757f',
  label: '#8a97a0',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

function PickCard({ hero, order }: { hero: HeroStat | undefined; order: number }) {
  if (!hero) return <div style={{ width: 138, height: 78, background: '#14181b' }} />
  return (
    <a href={`/hero/${heroSlug(hero.localized_name)}`} className="block hover:brightness-125" style={{ width: 138 }}>
      <div className="relative">
        <img
          src={heroLandscapeUrl(hero.name)}
          alt={hero.localized_name}
          style={{ width: 138, height: 78, objectFit: 'cover' }}
          onError={cdnFallback(heroLandscapeCdn(hero.name))}
        />
        <span
          className="absolute top-0 left-0 px-1.5 text-[12px] tabular-nums"
          style={{ background: 'rgba(8,10,12,0.85)', color: C.label, fontFamily: 'var(--font-dota)' }}
        >
          {order}
        </span>
      </div>
      <div
        className="mt-1 text-[13px] uppercase truncate"
        style={{ color: '#e8ecef', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
      >
        {hero.localized_name}
      </div>
    </a>
  )
}

function BanThumb({ hero, order }: { hero: HeroStat | undefined; order: number }) {
  if (!hero) return <div style={{ width: 92, height: 52, background: '#14181b' }} />
  return (
    <div className="relative shrink-0" title={`${hero.localized_name} (ban #${order})`} style={{ width: 92 }}>
      <img
        src={heroLandscapeUrl(hero.name)}
        alt={hero.localized_name}
        style={{ width: 92, height: 52, objectFit: 'cover', filter: 'grayscale(1) brightness(0.55)' }}
        onError={cdnFallback(heroLandscapeCdn(hero.name))}
      />
      {/* diagonal strike */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top right, transparent 47%, rgba(201,74,56,0.9) 48%, rgba(201,74,56,0.9) 52%, transparent 53%)' }}
      />
      <span
        className="absolute top-0 left-0 px-1 text-[11px] tabular-nums"
        style={{ background: 'rgba(8,10,12,0.85)', color: C.dim, fontFamily: 'var(--font-dota)' }}
      >
        {order}
      </span>
    </div>
  )
}

export function DraftPanel({
  picksBans,
  heroStats,
}: {
  picksBans: PickBan[] | null
  heroStats: HeroStat[]
}) {
  if (!picksBans || picksBans.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
          Draft data unavailable.
        </span>
      </div>
    )
  }

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const ordered = [...picksBans].sort((a, b) => a.order - b.order)

  const teamPanel = (team: number, isRadiant: boolean) => {
    const picks = ordered.filter((pb) => pb.is_pick && pb.team === team)
    const bans = ordered.filter((pb) => !pb.is_pick && pb.team === team)
    const color = isRadiant ? C.green : C.red
    return (
      <div style={{ background: C.panel }}>
        <div
          className="text-[17px] px-4 py-3"
          style={{
            color,
            background: C.panelDark,
            fontFamily: 'var(--font-dota)',
            textShadow: `0 1px 3px rgba(0,0,0,0.9), 0 0 10px ${color}44`,
          }}
        >
          {isRadiant ? 'The Radiant' : 'The Dire'}
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="mb-2 text-[13px] uppercase" style={{ color: C.label, letterSpacing: '2px', fontFamily: 'var(--font-dota)' }}>
              Picks
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {picks.map((pb) => (
                <PickCard key={pb.order} hero={heroMap.get(pb.hero_id)} order={pb.order + 1} />
              ))}
            </div>
          </div>
          {bans.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] uppercase" style={{ color: C.label, letterSpacing: '2px', fontFamily: 'var(--font-dota)' }}>
                Bans
              </div>
              <div className="flex gap-2 flex-wrap">
                {bans.map((pb) => (
                  <BanThumb key={pb.order} hero={heroMap.get(pb.hero_id)} order={pb.order + 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {teamPanel(0, true)}
      {teamPanel(1, false)}
    </div>
  )
}
