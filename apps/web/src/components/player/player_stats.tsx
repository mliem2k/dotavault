import type { PlayerWL } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'

/* Stats tab — lifetime totals plus win-rate breakdowns by side, lane role,
   game mode, and lobby type from OpenDota's totals/counts endpoints. */

const C = {
  label: '#8a97a0',
  dim: '#8a8474',
  text: '#cfd4d8',
  white: '#ffffff',
  gold: '#f2c94c',
  green: '#8fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type Total = { field: string; n: number; sum: number }
type Counts = Record<string, Record<string, { games: number; win: number }>>

const GAME_MODES: Record<string, string> = {
  '1': 'All Pick', '2': 'Captains Mode', '3': 'Random Draft', '4': 'Single Draft',
  '5': 'All Random', '12': 'Least Played', '16': 'Captains Draft', '18': 'Ability Draft',
  '19': 'Event', '20': 'ARDM', '22': 'Ranked All Pick', '23': 'Turbo',
}

const LOBBY_TYPES: Record<string, string> = {
  '0': 'Normal', '1': 'Practice', '2': 'Tournament', '4': 'Co-op Bots',
  '5': 'Ranked Team', '6': 'Ranked Solo', '7': 'Ranked', '8': '1v1 Mid', '9': 'Battle Cup',
}

const LANE_ROLES: Record<string, string> = {
  '0': 'Unknown', '1': 'Safe Lane', '2': 'Mid Lane', '3': 'Off Lane', '4': 'Jungle',
}

function sum(totals: Total[], field: string): number {
  return totals.find((t) => t.field === field)?.sum ?? 0
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-[22px] leading-tight tabular-nums" style={{ color: C.gold, fontFamily: 'var(--font-dota)' }}>
        {value}
      </div>
      <div className="text-[11px] uppercase mt-0.5" style={{ color: C.label, letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}>
        {label}
      </div>
    </div>
  )
}

type RateSortKey = 'label' | 'winrate' | 'games'

function WinRateTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; games: number; win: number }[]
}) {
  const { key: sortKey, dir: sortDir, onSort } = useSort<RateSortKey>('games', 'desc')
  const qualifying = rows.filter((r) => r.games > 0)
  const shown = applySort(qualifying, sortDir, (a, b) => {
    switch (sortKey) {
      case 'label':
        return a.label.localeCompare(b.label)
      case 'winrate':
        return a.win / a.games - b.win / b.games
      default:
        return a.games - b.games
    }
  })
  if (shown.length === 0) return null
  return (
    <div style={{ background: C.panel }}>
      <div
        className="text-[13px] uppercase px-3 py-2.5"
        style={{ color: C.white, letterSpacing: '2px', background: C.panelDark, fontFamily: 'var(--font-dota)' }}
      >
        {title}
      </div>
      <div className="flex items-center gap-3 px-3 pt-2 text-[11px] uppercase" style={{ color: C.label, fontFamily: 'var(--font-dota)' }}>
        <SortHeader label="Label" sortKey="label" active={sortKey === 'label'} dir={sortDir} onClick={onSort} className="w-32 shrink-0" />
        <span className="flex-1" />
        <SortHeader label="Win Rate" sortKey="winrate" active={sortKey === 'winrate'} dir={sortDir} onClick={onSort} className="w-14 shrink-0 justify-end" />
        <SortHeader label="Games" sortKey="games" active={sortKey === 'games'} dir={sortDir} onClick={onSort} className="w-20 shrink-0 justify-end" />
      </div>
      <div className="px-3 py-2">
        {shown.map((r) => {
          const pct = (r.win / r.games) * 100
          return (
            <div key={r.label} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="w-32 shrink-0 text-[14px] truncate" style={{ color: C.text, fontFamily: 'var(--font-dota)' }}>
                {r.label}
              </span>
              <div className="flex-1 h-[6px]" style={{ background: '#2c3236' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 50 ? C.green : C.red }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[14px] tabular-nums" style={{ color: pct >= 50 ? C.green : C.red, fontFamily: 'var(--font-dota)' }}>
                {pct.toFixed(1)}%
              </span>
              <span className="w-20 shrink-0 text-right text-[13px] tabular-nums" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
                {r.games.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlayerStats({
  totals,
  counts,
  wl,
}: {
  totals: Total[]
  counts: Counts | undefined
  wl: PlayerWL
}) {
  const games = wl.win + wl.lose
  const hours = Math.round(sum(totals, 'duration') / 3600)

  const tiles: [string, string][] = [
    [games.toLocaleString(), 'Matches'],
    [`${hours.toLocaleString()}h`, 'Time Played'],
    [sum(totals, 'kills').toLocaleString(), 'Kills'],
    [sum(totals, 'deaths').toLocaleString(), 'Deaths'],
    [sum(totals, 'assists').toLocaleString(), 'Assists'],
    [sum(totals, 'last_hits').toLocaleString(), 'Last Hits'],
    [sum(totals, 'denies').toLocaleString(), 'Denies'],
    [sum(totals, 'hero_damage').toLocaleString(), 'Hero Damage'],
    [sum(totals, 'hero_healing').toLocaleString(), 'Healing'],
    [sum(totals, 'tower_damage').toLocaleString(), 'Tower Damage'],
    [(sum(totals, 'purchase_ward_observer') + sum(totals, 'purchase_ward_sentry')).toLocaleString(), 'Wards Placed'],
    [`${Math.round(sum(totals, 'stuns')).toLocaleString()}s`, 'Stun Duration'],
  ]

  const table = (key: string, title: string, names: Record<string, string>) => {
    const c = counts?.[key]
    if (!c) return null
    return (
      <WinRateTable
        title={title}
        rows={Object.entries(c).map(([k, v]) => ({
          label: names[k] ?? `${title.split(' ')[0]} ${k}`,
          games: v.games,
          win: v.win,
        }))}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Lifetime totals */}
      <div style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: C.panelDark, fontFamily: 'var(--font-dota)' }}
        >
          Lifetime Totals
        </div>
        <div className="grid gap-2 p-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {tiles.map(([v, l]) => (
            <StatTile key={l} value={v} label={l} />
          ))}
        </div>
      </div>

      {/* Win rate breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {table('is_radiant', 'Win Rate by Side', { '0': 'Dire', '1': 'Radiant' })}
        {table('lane_role', 'Win Rate by Lane', LANE_ROLES)}
        {table('game_mode', 'Win Rate by Game Mode', GAME_MODES)}
        {table('lobby_type', 'Win Rate by Lobby', LOBBY_TYPES)}
      </div>
    </div>
  )
}
