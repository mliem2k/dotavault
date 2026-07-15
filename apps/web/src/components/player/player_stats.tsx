import type { PlayerMatch, PlayerWL } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'

/* Stats tab — lifetime totals plus win-rate breakdowns by side, lane role,
   game mode, and lobby type from OpenDota's totals/counts endpoints. */

// `dim` and `green` are deliberately close-but-not-identical to the shared
// muted/radiant tokens (not exact matches), so they stay as raw hex per the
// token mapping reference rather than being guessed onto a token.
const C = {
  dim: '#8a8474',
  green: '#8fbf3f',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type Total = { field: string; n: number; sum: number }
type Counts = Record<string, Record<string, { games: number; win: number }>>

const GAME_MODES: Record<string, string> = {
  '1': 'All Pick',
  '2': 'Captains Mode',
  '3': 'Random Draft',
  '4': 'Single Draft',
  '5': 'All Random',
  '12': 'Least Played',
  '16': 'Captains Draft',
  '18': 'Ability Draft',
  '19': 'Event',
  '20': 'ARDM',
  '22': 'Ranked All Pick',
  '23': 'Turbo',
}

const LOBBY_TYPES: Record<string, string> = {
  '0': 'Normal',
  '1': 'Practice',
  '2': 'Tournament',
  '4': 'Co-op Bots',
  '5': 'Ranked Team',
  '6': 'Ranked Solo',
  '7': 'Ranked',
  '8': '1v1 Mid',
  '9': 'Battle Cup',
}

const LANE_ROLES: Record<string, string> = {
  '0': 'Unknown',
  '1': 'Safe Lane',
  '2': 'Mid Lane',
  '3': 'Off Lane',
  '4': 'Jungle',
}

function sum(totals: Total[], field: string): number {
  return totals.find((t) => t.field === field)?.sum ?? 0
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-[22px] leading-tight tabular-nums text-gold font-dota">{value}</div>
      <div
        className="text-[11px] uppercase mt-0.5 text-slate-muted-light font-dota"
        style={{ letterSpacing: '1px' }}
      >
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
        className="text-[13px] uppercase px-3 py-2.5 text-white font-dota"
        style={{ letterSpacing: '2px', background: C.panelDark }}
      >
        {title}
      </div>
      <div className="flex items-center gap-3 px-3 pt-2 text-[11px] uppercase text-slate-muted-light font-dota">
        <SortHeader
          label="Label"
          sortKey="label"
          active={sortKey === 'label'}
          dir={sortDir}
          onClick={onSort}
          className="w-32 shrink-0"
        />
        <span className="flex-1" />
        <SortHeader
          label="Win Rate"
          sortKey="winrate"
          active={sortKey === 'winrate'}
          dir={sortDir}
          onClick={onSort}
          className="w-14 shrink-0 justify-end"
        />
        <SortHeader
          label="Games"
          sortKey="games"
          active={sortKey === 'games'}
          dir={sortDir}
          onClick={onSort}
          className="w-20 shrink-0 justify-end"
        />
      </div>
      <div className="px-3 py-2">
        {shown.map((r) => {
          const pct = (r.win / r.games) * 100
          return (
            <div
              key={r.label}
              className="flex items-center gap-3 py-1.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="w-32 shrink-0 text-[14px] truncate text-slate-foreground font-dota">
                {r.label}
              </span>
              <div className="flex-1 h-[6px] bg-slate-card">
                <div
                  className={pct < 50 ? 'bg-dire' : ''}
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: pct >= 50 ? C.green : undefined,
                  }}
                />
              </div>
              <span
                className={`w-14 shrink-0 text-right text-[14px] tabular-nums font-dota ${pct < 50 ? 'text-dire' : ''}`}
                style={{ color: pct >= 50 ? C.green : undefined }}
              >
                {pct.toFixed(1)}%
              </span>
              <span
                className="w-20 shrink-0 text-right text-[13px] tabular-nums font-dota"
                style={{ color: C.dim }}
              >
                {r.games.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Day-of-week breakdown of the player's most recently fetched matches (not
// full history - see the "Last N matches" caption this renders). Bar width
// is normalized to the busiest day's count, same normalization
// ItemPopularitySection already uses on the hero page, so even a skewed
// week produces a readable chart instead of every bar being unreadably
// short from normalizing to the 7-way total.
function ActivityByDaySection({ matches }: { matches: PlayerMatch[] }) {
  if (matches.length === 0) return null

  const counts = new Array(7).fill(0) as number[]
  for (const m of matches) {
    const dayIndex = (new Date(m.start_time * 1000).getDay() + 6) % 7
    counts[dayIndex] += 1
  }
  const maxCount = Math.max(1, ...counts)

  return (
    <div style={{ background: C.panel }}>
      <div
        className="text-[13px] uppercase px-3 py-2.5 text-white font-dota"
        style={{ letterSpacing: '2px', background: C.panelDark }}
      >
        Activity by Day
      </div>
      <div className="px-3 py-2">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-3 py-1.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <span className="w-32 shrink-0 text-[14px] truncate text-slate-foreground font-dota">
              {label}
            </span>
            <div className="flex-1 h-[6px] bg-slate-card">
              <div
                style={{
                  width: `${(counts[i] / maxCount) * 100}%`,
                  height: '100%',
                  background: C.green,
                }}
              />
            </div>
            <span
              className="w-20 shrink-0 text-right text-[13px] tabular-nums font-dota"
              style={{ color: C.dim }}
            >
              {counts[i]}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 text-[12px] font-dota" style={{ color: C.dim }}>
        Last {matches.length.toLocaleString()} matches.
      </div>
    </div>
  )
}

export function PlayerStats({
  totals,
  counts,
  wl,
  matches,
}: {
  totals: Total[]
  counts: Counts | undefined
  wl: PlayerWL
  matches: PlayerMatch[] | undefined
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
    [
      (
        sum(totals, 'purchase_ward_observer') + sum(totals, 'purchase_ward_sentry')
      ).toLocaleString(),
      'Wards Placed',
    ],
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
          className="text-[15px] uppercase px-4 py-3 text-white font-dota"
          style={{ letterSpacing: '2px', background: C.panelDark }}
        >
          Lifetime Totals
        </div>
        <div
          className="grid gap-2 p-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}
        >
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

      {matches && <ActivityByDaySection matches={matches} />}
    </div>
  )
}
