import { Link } from '@tanstack/react-router'
import type { HeroStat } from 'types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { heroIconFromPath } from '@/lib/utils'

export function HeroRankingsSection({
  rankings,
  heroStats,
}: {
  rankings: { hero_id: number; score: number; percent_rank: number }[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const top = [...rankings].sort((a, b) => b.percent_rank - a.percent_rank).slice(0, 10)

  if (top.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted">
        Not enough hero data available for this player yet.
      </div>
    )
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow className="hover:bg-transparent text-left text-xs text-muted">
          <TableHead className="h-auto px-0 pb-2 font-normal text-muted whitespace-normal">
            Hero
          </TableHead>
          <TableHead className="h-auto px-0 pb-2 text-right font-mono font-normal text-muted">
            Score
          </TableHead>
          <TableHead className="h-auto px-0 pb-2 text-right font-mono font-normal text-muted">
            Percentile
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {top.map((r, i) => {
          const hero = heroMap.get(r.hero_id)
          const topPercent = Math.max(1, Math.round((1 - r.percent_rank) * 100))
          return (
            <TableRow
              key={r.hero_id}
              className={`hover:bg-transparent border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
            >
              <TableCell className="p-0 py-1.5 whitespace-normal">
                <Link
                  to="/hero/$heroName"
                  params={{
                    heroName: hero?.name.replace('npc_dota_hero_', '') ?? String(r.hero_id),
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
                  <span>{hero?.localized_name ?? r.hero_id}</span>
                </Link>
              </TableCell>
              <TableCell className="p-0 py-1.5 text-right font-mono text-foreground">
                {Math.round(r.score).toLocaleString()}
              </TableCell>
              <TableCell
                className={`p-0 py-1.5 text-right font-mono ${
                  r.percent_rank >= 0.9 ? 'text-radiant' : 'text-gold'
                }`}
              >
                Top {topPercent}%
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
