import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MAP_MAX, MAP_MIN } from '@/lib/buildings'
import { playerColor } from '@/lib/dotaconst'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { usePlayerName } from './match_roster'

/* Laning tab (OpenDota-style): where each hero actually stood during the
   laning phase (players[].lane_pos, a position-count heatmap over the first
   ~10 minutes) plus a lane performance table at the 10 minute mark. */

const C = {
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

const LANE_NAMES: Record<number, string> = { 1: 'Safe', 2: 'Mid', 3: 'Off', 4: 'Jungle' }

type SortKey = 'player' | 'lane' | 'eff' | 'lh' | 'gold' | 'xp'

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
}

function LaningRow({
  player: p,
  hero,
  at10,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  at10: (arr: number[] | null | undefined) => number | null
}) {
  const name = usePlayerName(p)
  const isRadiant = p.player_slot < 128
  return (
    <TableRow className="hover:bg-transparent border-t border-white/5 border-x-0 border-b-0">
      <TableCell className="p-0 px-2 py-1.5 whitespace-normal">
        <div className="flex items-center gap-2">
          <span style={{ width: 3, height: 20, background: playerColor(p.player_slot) }} />
          <a
            href={hero ? `/hero/${heroSlug(hero.localized_name)}` : '#'}
            className="block shrink-0"
          >
            <img
              src={hero ? heroIconUrl(hero.name) : ''}
              alt=""
              title={hero?.localized_name}
              style={{ width: 24, height: 24 }}
              onError={(e) => {
                if (!hero) return
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(hero.icon)
              }}
            />
          </a>
          <span
            className={`max-w-[120px] truncate text-[13px] ${isRadiant ? 'text-radiant' : 'text-dire'}`}
          >
            {name}
          </span>
        </div>
      </TableCell>
      <TableCell className="p-0 px-2 text-[13px] text-slate-foreground whitespace-normal">
        {p.lane_role ? (LANE_NAMES[p.lane_role] ?? '?') : '?'}
      </TableCell>
      <TableCell
        className={`p-0 px-2 text-right text-[13px] tabular-nums ${p.lane_efficiency_pct != null && p.lane_efficiency_pct >= 60 ? 'text-gold' : 'text-slate-foreground'}`}
      >
        {p.lane_efficiency_pct != null ? `${p.lane_efficiency_pct}%` : '-'}
      </TableCell>
      <TableCell className="p-0 px-2 text-right text-[13px] tabular-nums text-slate-foreground">
        {at10(p.lh_t) ?? '-'} / {at10(p.dn_t) ?? '-'}
      </TableCell>
      <TableCell className="p-0 px-2 text-right text-[13px] tabular-nums text-gold">
        {at10(p.gold_t)?.toLocaleString() ?? '-'}
      </TableCell>
      <TableCell className="p-0 px-2 text-right text-[13px] tabular-nums text-slate-foreground">
        {at10(p.xp_t)?.toLocaleString() ?? '-'}
      </TableCell>
    </TableRow>
  )
}

export function MatchLaning({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)

  const withData = useMemo(
    () => match.players.filter((p) => p.lane_pos && Object.keys(p.lane_pos).length > 0),
    [match.players],
  )
  const [visible, setVisible] = useState<Set<number>>(
    () => new Set(withData.map((p) => p.player_slot)),
  )

  function toggle(slot: number) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width

    ctx.clearRect(0, 0, size, size)
    if (mapImgRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, size, size)
      ctx.fillStyle = 'rgba(4,8,12,0.45)'
      ctx.fillRect(0, 0, size, size)
    } else {
      ctx.fillStyle = '#0a1a0a'
      ctx.fillRect(0, 0, size, size)
    }

    const cell = size / (MAP_MAX - MAP_MIN)
    for (const p of withData) {
      if (!visible.has(p.player_slot) || !p.lane_pos) continue
      const color = playerColor(p.player_slot)
      let max = 1
      for (const inner of Object.values(p.lane_pos)) {
        for (const count of Object.values(inner)) if (count > max) max = count
      }
      for (const [xs, inner] of Object.entries(p.lane_pos)) {
        for (const [ys, count] of Object.entries(inner)) {
          const cx = toCanvas(Number(xs), size)
          const cy = size - toCanvas(Number(ys), size)
          ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, count / max)
          ctx.fillStyle = color
          ctx.fillRect(cx - cell, cy - cell * 2, cell * 2, cell * 2)
        }
      }
    }
    ctx.globalAlpha = 1
  }, [withData, visible])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const img = new Image()
    img.src = '/minimap.webp'
    img.onload = () => {
      mapImgRef.current = img
      draw()
    }
  }, [draw])

  const at10 = (arr: number[] | null | undefined) =>
    arr?.[Math.min(10, (arr?.length ?? 1) - 1)] ?? null

  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('eff', 'desc')

  // LH / DN renders as one combined cell, but only last hits (the more
  // meaningful farm signal) drives the sort — denies aren't exposed as a
  // separate sortable column.
  const compare = (a: MatchPlayer, b: MatchPlayer) => {
    switch (sortKey) {
      case 'player':
        return (a.personaname ?? a.name ?? 'Anonymous').localeCompare(
          b.personaname ?? b.name ?? 'Anonymous',
        )
      case 'lane':
        return (a.lane_role ?? 0) - (b.lane_role ?? 0)
      case 'lh':
        return (at10(a.lh_t) ?? -1) - (at10(b.lh_t) ?? -1)
      case 'gold':
        return (at10(a.gold_t) ?? -1) - (at10(b.gold_t) ?? -1)
      case 'xp':
        return (at10(a.xp_t) ?? -1) - (at10(b.xp_t) ?? -1)
      default:
        return (a.lane_efficiency_pct ?? -1) - (b.lane_efficiency_pct ?? -1)
    }
  }
  const radiantSorted = applySort(
    match.players.filter((p) => p.player_slot < 128),
    sortDir,
    compare,
  )
  const direSorted = applySort(
    match.players.filter((p) => p.player_slot >= 128),
    sortDir,
    compare,
  )

  const statRow = (p: MatchPlayer) => (
    <LaningRow key={p.player_slot} player={p} hero={heroMap.get(p.hero_id)} at10={at10} />
  )

  return (
    <div className="flex flex-wrap gap-4 font-dota">
      <div className="min-w-[420px] flex-1" style={{ background: C.panel }}>
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-2.5"
          style={{ background: C.panelDark }}
        >
          <span className="text-[15px] uppercase text-white" style={{ letterSpacing: '2px' }}>
            Laning Phase
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            {withData.map((p) => {
              const hero = heroMap.get(p.hero_id)
              const active = visible.has(p.player_slot)
              return (
                <button
                  key={p.player_slot}
                  type="button"
                  onClick={() => toggle(p.player_slot)}
                  title={hero?.localized_name}
                  className="cursor-pointer p-0.5"
                  style={{
                    border: `2px solid ${active ? playerColor(p.player_slot) : 'transparent'}`,
                    opacity: active ? 1 : 0.4,
                    background: 'rgba(8,10,12,0.6)',
                  }}
                >
                  <img
                    src={hero ? heroIconUrl(hero.name) : ''}
                    alt=""
                    style={{ width: 22, height: 22, display: 'block' }}
                    onError={(e) => {
                      if (!hero) return
                      const img = e.currentTarget
                      img.onerror = null
                      img.src = heroIconFromPath(hero.icon)
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex justify-center p-4">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="w-full max-w-[560px] border border-slate-bg"
          />
        </div>
        <p className="px-4 pb-4 text-center text-[13px] text-slate-muted">
          Position heatmap during the laning phase, colored per player. Toggle heroes above.
        </p>
      </div>

      <div className="w-[430px] shrink-0 self-start" style={{ background: C.panel }}>
        <div
          className="px-4 py-3 text-[15px] uppercase text-white"
          style={{ letterSpacing: '2px', background: C.panelDark }}
        >
          Lane Performance at 10:00
        </div>
        <Table className="w-full">
          <TableHeader>
            <TableRow
              className="hover:bg-transparent text-left text-[12px] uppercase text-slate-muted border-none"
              style={{ letterSpacing: '1px' }}
            >
              <TableHead className="h-auto px-2 py-2">
                <SortHeader
                  label="Player"
                  sortKey="player"
                  active={sortKey === 'player'}
                  dir={sortDir}
                  onClick={onSort}
                />
              </TableHead>
              <TableHead className="h-auto px-2">
                <SortHeader
                  label="Lane"
                  sortKey="lane"
                  active={sortKey === 'lane'}
                  dir={sortDir}
                  onClick={onSort}
                />
              </TableHead>
              <TableHead
                className="h-auto px-2 text-right"
                title="Lane efficiency: share of the maximum possible lane farm"
              >
                <SortHeader
                  label="Eff"
                  sortKey="eff"
                  active={sortKey === 'eff'}
                  dir={sortDir}
                  onClick={onSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="h-auto px-2 text-right">
                <SortHeader
                  label="LH / DN"
                  sortKey="lh"
                  active={sortKey === 'lh'}
                  dir={sortDir}
                  onClick={onSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="h-auto px-2 text-right">
                <SortHeader
                  label="Gold"
                  sortKey="gold"
                  active={sortKey === 'gold'}
                  dir={sortDir}
                  onClick={onSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="h-auto px-2 text-right">
                <SortHeader
                  label="XP"
                  sortKey="xp"
                  active={sortKey === 'xp'}
                  dir={sortDir}
                  onClick={onSort}
                  className="justify-end"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {radiantSorted.map(statRow)}
            <TableRow className="hover:bg-transparent border-none">
              <TableCell colSpan={6} className="p-0" style={{ height: 8 }} />
            </TableRow>
            {direSorted.map(statRow)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
