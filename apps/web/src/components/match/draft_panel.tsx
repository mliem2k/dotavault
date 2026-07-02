import type { HeroStat, PickBan } from 'types'
import { heroIconFromPath } from '@/lib/utils'

function HeroIcon({
  heroId,
  heroMap,
  dim,
}: {
  heroId: number
  heroMap: Map<number, HeroStat>
  dim?: boolean
}) {
  const h = heroMap.get(heroId)
  if (!h) return <div className="h-8 w-8 rounded bg-card" />
  return (
    <img
      src={heroIconFromPath(h.icon)}
      alt={h.localized_name}
      title={h.localized_name}
      className={`h-8 w-8 rounded ${dim ? 'opacity-30 grayscale' : ''}`}
    />
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
    return <div className="text-xs text-muted">Draft data unavailable</div>
  }

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiantPicks = picksBans.filter((pb) => pb.is_pick && pb.team === 0)
  const direPicks = picksBans.filter((pb) => pb.is_pick && pb.team === 1)
  const radiantBans = picksBans.filter((pb) => !pb.is_pick && pb.team === 0)
  const direBans = picksBans.filter((pb) => !pb.is_pick && pb.team === 1)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 text-xs text-radiant">Radiant Picks</div>
          <div className="flex gap-1">
            {radiantPicks.map((pb) => (
              <HeroIcon key={pb.order} heroId={pb.hero_id} heroMap={heroMap} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs text-dire">Dire Picks</div>
          <div className="flex justify-end gap-1">
            {direPicks.map((pb) => (
              <HeroIcon key={pb.order} heroId={pb.hero_id} heroMap={heroMap} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 text-xs text-muted">Radiant Bans</div>
          <div className="flex gap-1">
            {radiantBans.map((pb) => (
              <HeroIcon key={pb.order} heroId={pb.hero_id} heroMap={heroMap} dim />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs text-muted">Dire Bans</div>
          <div className="flex justify-end gap-1">
            {direBans.map((pb) => (
              <HeroIcon key={pb.order} heroId={pb.hero_id} heroMap={heroMap} dim />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
