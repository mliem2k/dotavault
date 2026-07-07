import { useMemo } from 'react'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { orderTypeName, playerColor } from '@/lib/dotaconst'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

/* Actions tab (OpenDota-style): how each player actually piloted their hero:
   per-order-type command counts (players[].actions, keyed by unit order id)
   plus actions per minute. */

const C = {
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

// Column identity for the top-10 order-type columns is per-match (whatever
// order types were actually used), so only Player/APM/Total get sort
// controls — a fixed SortKey union can't cleanly cover a variable column set.
type SortKey = 'player' | 'apm' | 'total'

const totalActions = (p: MatchPlayer) => Object.values(p.actions ?? {}).reduce((s, v) => s + v, 0)

export function MatchActions({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('apm', 'desc')

  // Columns: order types seen in this match, by total volume.
  const columns = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of match.players) {
      for (const [id, n] of Object.entries(p.actions ?? {})) {
        totals.set(id, (totals.get(id) ?? 0) + n)
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 10)
  }, [match.players])

  const maxCell = useMemo(() => {
    let max = 1
    for (const p of match.players) {
      for (const id of columns) {
        const v = p.actions?.[id] ?? 0
        if (v > max) max = v
      }
    }
    return max
  }, [match.players, columns])

  const compare = (a: MatchPlayer, b: MatchPlayer) => {
    switch (sortKey) {
      case 'player':
        return (a.personaname ?? 'Anonymous').localeCompare(b.personaname ?? 'Anonymous')
      case 'total':
        return totalActions(a) - totalActions(b)
      default:
        return (a.actions_per_min ?? 0) - (b.actions_per_min ?? 0)
    }
  }
  const radiant = applySort(match.players.filter((p) => p.player_slot < 128), sortDir, compare)
  const dire = applySort(match.players.filter((p) => p.player_slot >= 128), sortDir, compare)

  const row = (p: MatchPlayer) => {
    const hero = heroMap.get(p.hero_id)
    const total = totalActions(p)
    return (
      <tr key={p.player_slot} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <td className="px-3 py-1.5">
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
            <span className="max-w-[130px] truncate text-[13px]" style={{ color: p.player_slot < 128 ? C.green : C.red }}>
              {p.personaname ?? 'Anonymous'}
            </span>
          </div>
        </td>
        <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: C.gold }}>
          {p.actions_per_min ?? '-'}
        </td>
        <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: C.white }}>
          {total ? total.toLocaleString() : '-'}
        </td>
        {columns.map((id) => {
          const v = p.actions?.[id] ?? 0
          return (
            <td key={id} className="px-1 py-1">
              <div
                className="flex h-[22px] items-center justify-center text-[13px] tabular-nums"
                style={{
                  background: v > 0 ? `rgba(159,191,63,${0.06 + 0.4 * (v / maxCell)})` : 'rgba(255,255,255,0.02)',
                  color: v > 0 ? C.text : '#3a4147',
                }}
              >
                {v ? v.toLocaleString() : ''}
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto" style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
      <div className="px-4 py-3 text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}>
        Actions
      </div>
      <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
        <thead>
          <tr className="text-[12px] uppercase" style={{ color: C.dim, letterSpacing: '1px' }}>
            <th className="px-3 py-2 text-left">
              <SortHeader label="Player" sortKey="player" active={sortKey === 'player'} dir={sortDir} onClick={onSort} />
            </th>
            <th className="px-2 text-right" title="Actions per minute">
              <SortHeader label="APM" sortKey="apm" active={sortKey === 'apm'} dir={sortDir} onClick={onSort} className="justify-end" />
            </th>
            <th className="px-2 text-right">
              <SortHeader label="Total" sortKey="total" active={sortKey === 'total'} dir={sortDir} onClick={onSort} className="justify-end" />
            </th>
            {columns.map((id) => (
              <th key={id} className="px-1 text-center" style={{ maxWidth: 90 }}>
                {orderTypeName(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {radiant.map(row)}
          <tr>
            <td colSpan={3 + columns.length} style={{ height: 10 }} />
          </tr>
          {dire.map(row)}
        </tbody>
      </table>
    </div>
  )
}
