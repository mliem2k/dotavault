import type { HeroStat, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { playerColor } from '@/lib/dotaconst'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

/* Fantasy tab: fantasy points per player using the standard OpenDota
   scoring (same components Dota's official fantasy leagues use). */

const C = {
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type SortKey =
  | 'player'
  | 'total'
  | 'kills'
  | 'deaths'
  | 'cs'
  | 'gpm'
  | 'towers'
  | 'roshan'
  | 'teamfight'
  | 'obswards'
  | 'stacks'
  | 'runes'
  | 'firstblood'
  | 'stuns'

type Component = {
  label: string
  key: SortKey
  value: (p: MatchPlayer) => number
  points: (p: MatchPlayer) => number
}

const COMPONENTS: Component[] = [
  { label: 'Kills', key: 'kills', value: (p) => p.kills, points: (p) => p.kills * 0.3 },
  { label: 'Deaths', key: 'deaths', value: (p) => p.deaths, points: (p) => 3 - p.deaths * 0.3 },
  { label: 'CS', key: 'cs', value: (p) => p.last_hits + p.denies, points: (p) => (p.last_hits + p.denies) * 0.003 },
  { label: 'GPM', key: 'gpm', value: (p) => p.gold_per_min, points: (p) => p.gold_per_min * 0.002 },
  { label: 'Towers', key: 'towers', value: (p) => p.towers_killed ?? 0, points: (p) => (p.towers_killed ?? 0) * 1 },
  { label: 'Roshan', key: 'roshan', value: (p) => p.roshans_killed ?? 0, points: (p) => (p.roshans_killed ?? 0) * 1 },
  {
    label: 'Teamfight',
    key: 'teamfight',
    value: (p) => Math.round((p.teamfight_participation ?? 0) * 100),
    points: (p) => (p.teamfight_participation ?? 0) * 3,
  },
  { label: 'Obs Wards', key: 'obswards', value: (p) => p.obs_placed ?? 0, points: (p) => (p.obs_placed ?? 0) * 0.5 },
  { label: 'Stacks', key: 'stacks', value: (p) => p.camps_stacked ?? 0, points: (p) => (p.camps_stacked ?? 0) * 0.5 },
  { label: 'Runes', key: 'runes', value: (p) => p.rune_pickups ?? 0, points: (p) => (p.rune_pickups ?? 0) * 0.25 },
  {
    label: 'First Blood',
    key: 'firstblood',
    value: (p) => p.firstblood_claimed ?? 0,
    points: (p) => (p.firstblood_claimed ?? 0) * 4,
  },
  { label: 'Stuns', key: 'stuns', value: (p) => Math.round(p.stuns ?? 0), points: (p) => (p.stuns ?? 0) * 0.05 },
]

const totalPoints = (p: MatchPlayer) => COMPONENTS.reduce((s, c) => s + c.points(p), 0)
const playerLabel = (p: MatchPlayer) => p.personaname ?? 'Anonymous'

export function MatchFantasy({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const best = Math.max(...match.players.map(totalPoints))
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('total', 'desc')

  const compare = (a: MatchPlayer, b: MatchPlayer) => {
    switch (sortKey) {
      case 'player':
        return playerLabel(a).localeCompare(playerLabel(b))
      case 'total':
        return totalPoints(a) - totalPoints(b)
      default: {
        const comp = COMPONENTS.find((c) => c.key === sortKey)
        return comp ? comp.value(a) - comp.value(b) : totalPoints(a) - totalPoints(b)
      }
    }
  }
  const radiant = applySort(match.players.filter((p) => p.player_slot < 128), sortDir, compare)
  const dire = applySort(match.players.filter((p) => p.player_slot >= 128), sortDir, compare)

  const row = (p: MatchPlayer) => {
    const hero = heroMap.get(p.hero_id)
    const total = totalPoints(p)
    return (
      <TableRow key={p.player_slot} className="hover:bg-transparent border-t border-white/5 border-x-0 border-b-0">
        <TableCell className="p-0 px-3 py-1.5 whitespace-normal">
          <div className="flex items-center gap-2">
            <span style={{ width: 3, height: 22, background: playerColor(p.player_slot) }} />
            <img
              src={hero ? heroIconUrl(hero.name) : ''}
              alt=""
              title={hero?.localized_name}
              style={{ width: 26, height: 26 }}
              onError={(e) => {
                if (!hero) return
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(hero.icon)
              }}
            />
            <span className={`max-w-[130px] truncate text-[13px] ${p.player_slot < 128 ? 'text-radiant' : 'text-dire'}`}>
              {p.personaname ?? 'Anonymous'}
            </span>
          </div>
        </TableCell>
        <TableCell className="p-0 px-2 text-right">
          <span
            className={`text-[15px] font-bold tabular-nums ${total === best ? 'text-gold' : 'text-white'}`}
            title={total === best ? 'Best fantasy score of the match' : undefined}
          >
            {total.toFixed(1)}
          </span>
        </TableCell>
        {COMPONENTS.map((c) => {
          const pts = c.points(p)
          return (
            <TableCell key={c.label} className="p-0 px-2 text-center whitespace-normal">
              <div className={`text-[13px] tabular-nums ${pts > 0 ? 'text-slate-foreground' : 'text-slate-border'}`}>
                {pts.toFixed(1)}
              </div>
              <div className="text-[11px] tabular-nums text-slate-muted">{c.value(p)}</div>
            </TableCell>
          )
        })}
      </TableRow>
    )
  }

  return (
    <div className="overflow-x-auto font-dota" style={{ background: C.panel }}>
      <div className="px-4 py-3 text-[15px] uppercase text-white" style={{ letterSpacing: '2px', background: C.panelDark }}>
        Fantasy Points
      </div>
      <Table className="w-full" style={{ minWidth: 1100 }}>
        <TableHeader>
          <TableRow className="hover:bg-transparent text-[12px] uppercase text-slate-muted border-none" style={{ letterSpacing: '1px' }}>
            <TableHead className="h-auto px-3 py-2 text-left">
              <SortHeader label="Player" sortKey="player" active={sortKey === 'player'} dir={sortDir} onClick={onSort} />
            </TableHead>
            <TableHead className="h-auto px-2 text-right">
              <SortHeader label="Total" sortKey="total" active={sortKey === 'total'} dir={sortDir} onClick={onSort} className="justify-end" />
            </TableHead>
            {COMPONENTS.map((c) => (
              <TableHead key={c.label} className="h-auto px-2 text-center">
                <SortHeader
                  label={c.label}
                  sortKey={c.key}
                  active={sortKey === c.key}
                  dir={sortDir}
                  onClick={onSort}
                  className="justify-center"
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {radiant.map(row)}
          <TableRow className="hover:bg-transparent border-none">
            <TableCell colSpan={2 + COMPONENTS.length} className="p-0" style={{ height: 10 }} />
          </TableRow>
          {dire.map(row)}
        </TableBody>
      </Table>
      <p className="px-4 py-3 text-[12px] text-slate-muted">
        Standard fantasy scoring: 0.3/kill, 3 minus 0.3/death, 0.003/CS, 0.002/GPM, 1/tower, 1/Roshan, 3 x teamfight
        share, 0.5/observer, 0.5/stack, 0.25/rune, 4/first blood, 0.05/stun second. Small values show points over raw
        stat.
      </p>
    </div>
  )
}
