import type { HeroStat, MatchPlayer } from 'types'
import { formatDuration, heroIconUrl, itemIconUrl } from '@/lib/utils'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

const CONSUMABLES = new Set([
  'tpscroll', 'flask', 'clarity', 'faerie_fire', 'smoke_of_deceit',
  'dust', 'ward_observer', 'ward_sentry', 'tome_of_knowledge',
])

type PurchaseEvent = {
  time: number
  key: string
  player: MatchPlayer
}

export function MatchPurchases({
  players,
  heroStats,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))

  const events: PurchaseEvent[] = []
  for (const p of players) {
    for (const entry of p.purchase_log ?? []) {
      if (!CONSUMABLES.has(entry.key)) {
        events.push({ time: entry.time, key: entry.key, player: p })
      }
    }
  }
  events.sort((a, b) => a.time - b.time)

  if (events.length === 0) {
    return <p className="px-4 pb-4 text-xs text-muted">No purchase data available for this match.</p>
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <div className="flex gap-1 flex-wrap px-4 pb-3 pt-1 border-b border-border/40">
        {players.map((p) => {
          const hero = heroMap.get(p.hero_id)
          const color = PLAYER_COLORS[p.player_slot] ?? '#888'
          return (
            <span key={p.player_slot} className="flex items-center gap-1 text-[10px]" style={{ color }}>
              {hero && <img src={heroIconUrl(hero.name)} alt="" className="h-4 w-4 rounded-sm" />}
              {hero?.localized_name ?? `Slot ${p.player_slot}`}
            </span>
          )
        })}
      </div>
      <div className="divide-y divide-border/20">
        {events.map((ev, i) => {
          const hero = heroMap.get(ev.player.hero_id)
          const color = PLAYER_COLORS[ev.player.player_slot] ?? '#888'
          return (
            <div key={i} className="flex items-center gap-2 px-4 py-1">
              <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted">
                {formatDuration(ev.time)}
              </span>
              {hero && (
                <img
                  src={heroIconUrl(hero.name)}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-sm"
                  style={{ border: `1px solid ${color}50` }}
                />
              )}
              <img
                src={itemIconUrl(ev.key)}
                alt={ev.key}
                className="h-5 w-5 shrink-0 rounded-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="text-xs text-foreground/80">
                {ev.key.replace(/_/g, ' ')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
