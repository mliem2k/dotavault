import { Link } from '@tanstack/react-router'
import type { HeroStat, PlayerHero } from 'types'
import { heroIconFromPath, winRate } from '@/lib/utils'

export function HeroStatsTable({
  playerHeroes,
  heroStats,
}: {
  playerHeroes: PlayerHero[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const sorted = [...playerHeroes]
    .filter((h) => h.games >= 3)
    .sort((a, b) => b.games - a.games)
    .slice(0, 15)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="pb-2 font-normal">Hero</th>
          <th className="pb-2 font-normal text-right font-mono">Games</th>
          <th className="pb-2 font-normal text-right font-mono">Win%</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((ph, i) => {
          const hero = heroMap.get(Number(ph.hero_id))
          return (
            <tr
              key={ph.hero_id}
              className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
            >
              <td className="py-1.5">
                <Link
                  to="/hero/$heroId"
                  params={{ heroId: ph.hero_id }}
                  className="flex items-center gap-2 hover:text-accent"
                >
                  {hero && (
                    <img
                      src={heroIconFromPath(hero.icon)}
                      alt={hero.localized_name}
                      className="h-6 w-6 rounded"
                    />
                  )}
                  <span>{hero?.localized_name ?? ph.hero_id}</span>
                </Link>
              </td>
              <td className="py-1.5 text-right font-mono text-foreground">{ph.games}</td>
              <td className="py-1.5 text-right font-mono text-foreground">
                {winRate(ph.win, ph.games)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
