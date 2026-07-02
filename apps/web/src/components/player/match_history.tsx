import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { HeroStat, PlayerMatch } from 'types'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

function isWin(match: PlayerMatch): boolean {
  return match.player_slot < 128 ? match.radiant_win : !match.radiant_win
}

export function MatchHistory({
  matches,
  heroStats,
}: {
  matches: PlayerMatch[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const m = matches[item.index]
          const won = isWin(m)
          const hero = heroMap.get(m.hero_id)
          return (
            <Link
              key={m.match_id}
              to="/match/$matchId"
              params={{ matchId: String(m.match_id) }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/5"
            >
              <div className={`h-1.5 w-1.5 rounded-full ${won ? 'bg-radiant' : 'bg-dire'}`} />
              {hero && (
                <img
                  src={`https://cdn.cloudflare.steamstatic.com${hero.icon}`}
                  alt={hero.localized_name}
                  className="h-7 w-7 rounded"
                />
              )}
              <span className="flex-1 text-foreground">{hero?.localized_name ?? m.hero_id}</span>
              <span className="font-mono text-foreground">
                {m.kills}/{m.deaths}/{m.assists}
              </span>
              <span className="w-14 text-right font-mono text-xs text-muted">
                {formatDuration(m.duration)}
              </span>
              <span className="w-16 text-right font-mono text-xs text-muted">
                {formatTimeAgo(m.start_time)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
