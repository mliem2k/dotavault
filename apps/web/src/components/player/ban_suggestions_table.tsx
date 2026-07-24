import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { HeroStat, PlayerHero } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, winRate } from '@/lib/utils'

type SortKey = 'hero' | 'games' | 'winrate'

const SHOWN = 15
const MIN_GAMES_FACED = 3

export function BanSuggestionsTable({
  playerHeroes,
  heroStats,
}: {
  playerHeroes: PlayerHero[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  // Worst matchup first by default: this table's whole point is a ranked
  // ban priority list, not a "what have I faced most" browse.
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('winrate', 'asc')
  const [showAll, setShowAll] = useState(false)

  const qualifying = playerHeroes.filter((h) => h.against_games >= MIN_GAMES_FACED)
  const sorted = applySort(qualifying, sortDir, (a, b) => {
    switch (sortKey) {
      case 'hero':
        return (heroMap.get(Number(a.hero_id))?.localized_name ?? '').localeCompare(
          heroMap.get(Number(b.hero_id))?.localized_name ?? '',
        )
      case 'winrate':
        return (
          a.against_win / Math.max(1, a.against_games) -
          b.against_win / Math.max(1, b.against_games)
        )
      default:
        return a.against_games - b.against_games
    }
  })
  const shown = showAll ? sorted : sorted.slice(0, SHOWN)

  if (qualifying.length === 0) {
    return (
      <p className="text-sm text-muted py-4 text-center">
        No enemy heroes faced {MIN_GAMES_FACED}+ times this patch yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Your win rate in games where this hero was on the enemy team.
      </p>
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent text-left text-xs text-muted">
            <TableHead className="h-auto px-0 pb-2 font-normal text-muted whitespace-normal">
              <SortHeader
                label="Hero"
                sortKey="hero"
                active={sortKey === 'hero'}
                dir={sortDir}
                onClick={onSort}
              />
            </TableHead>
            <TableHead className="h-auto px-0 pb-2 text-right font-mono font-normal text-muted">
              <SortHeader
                label="Games Faced"
                sortKey="games"
                active={sortKey === 'games'}
                dir={sortDir}
                onClick={onSort}
                className="justify-end"
              />
            </TableHead>
            <TableHead className="h-auto px-0 pb-2 text-right font-mono font-normal text-muted">
              <SortHeader
                label="Your Win% vs"
                sortKey="winrate"
                active={sortKey === 'winrate'}
                dir={sortDir}
                onClick={onSort}
                className="justify-end"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((ph, i) => {
            const hero = heroMap.get(Number(ph.hero_id))
            return (
              <TableRow
                key={ph.hero_id}
                className={`hover:bg-transparent border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <TableCell className="p-0 py-1.5 whitespace-normal">
                  <Link
                    to="/hero/$heroName"
                    params={{
                      heroName: hero?.name.replace('npc_dota_hero_', '') ?? String(ph.hero_id),
                    }}
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
                </TableCell>
                <TableCell className="p-0 py-1.5 text-right font-mono text-foreground">
                  {ph.against_games}
                </TableCell>
                <TableCell className="p-0 py-1.5 text-right font-mono text-foreground">
                  {winRate(ph.against_win, ph.against_games)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        {sorted.length > SHOWN && (
          <TableFooter className="border-t-0 bg-transparent font-normal">
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="p-0 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs uppercase text-muted hover:text-accent cursor-pointer"
                >
                  {showAll ? 'Show Less' : `Show All ${sorted.length} Heroes`}
                </button>
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
