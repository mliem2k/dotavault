import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { HeroStat, PlayerHero } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, winRate } from '@/lib/utils'

type SortKey = 'hero' | 'games' | 'winrate'

const SHOWN = 15

export function HeroStatsTable({
  playerHeroes,
  heroStats,
}: {
  playerHeroes: PlayerHero[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('games', 'desc')
  const [showAll, setShowAll] = useState(false)

  const qualifying = playerHeroes.filter((h) => h.games >= 3)
  const sorted = applySort(qualifying, sortDir, (a, b) => {
    switch (sortKey) {
      case 'hero':
        return (heroMap.get(Number(a.hero_id))?.localized_name ?? '').localeCompare(
          heroMap.get(Number(b.hero_id))?.localized_name ?? '',
        )
      case 'winrate':
        return a.win / Math.max(1, a.games) - b.win / Math.max(1, b.games)
      default:
        return a.games - b.games
    }
  })
  const shown = showAll ? sorted : sorted.slice(0, SHOWN)

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="pb-2 font-normal">
            <SortHeader label="Hero" sortKey="hero" active={sortKey === 'hero'} dir={sortDir} onClick={onSort} />
          </th>
          <th className="pb-2 font-normal text-right font-mono">
            <SortHeader label="Games" sortKey="games" active={sortKey === 'games'} dir={sortDir} onClick={onSort} className="justify-end" />
          </th>
          <th className="pb-2 font-normal text-right font-mono">
            <SortHeader label="Win%" sortKey="winrate" active={sortKey === 'winrate'} dir={sortDir} onClick={onSort} className="justify-end" />
          </th>
        </tr>
      </thead>
      <tbody>
        {shown.map((ph, i) => {
          const hero = heroMap.get(Number(ph.hero_id))
          return (
            <tr
              key={ph.hero_id}
              className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
            >
              <td className="py-1.5">
                <Link
                  to="/hero/$heroName"
                  params={{ heroName: hero?.name.replace('npc_dota_hero_', '') ?? String(ph.hero_id) }}
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
      {sorted.length > SHOWN && (
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs uppercase text-muted hover:text-accent cursor-pointer"
              >
                {showAll ? 'Show Less' : `Show All ${sorted.length} Heroes`}
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}
