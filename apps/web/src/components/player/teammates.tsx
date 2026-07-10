import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'

// `dim` and `green` are deliberately close-but-not-identical to the shared
// muted/radiant tokens (not exact matches), so they stay as raw hex per the
// token mapping reference rather than being guessed onto a token.
const C = {
  dim: '#8a8474',
  green: '#8fbf3f',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type SortKey = 'player' | 'games' | 'wins' | 'winrate' | 'last'

export type Peer = {
  account_id: number
  personaname: string | null
  avatarfull: string | null
  last_played: number
  with_games: number
  with_win: number
  against_games: number
  against_win: number
}

function fmtDate(unix: number): string {
  const d = new Date(unix * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

// `red` maps exactly onto the shared `text-dire` token, but `green` doesn't
// match either of the shared radiant hexes closely enough to guess, so the
// win-rate color splits into a token className (loss) plus a raw inline
// style (win).
function wrStyle(pct: number): { className: string; color?: string } {
  return pct >= 50
    ? { className: '', color: C.green }
    : { className: 'text-dire', color: undefined }
}

export function Teammates({ peers }: { peers: Peer[] }) {
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('games', 'desc')

  // Cap to the 100 most-played-with teammates, then apply the chosen sort.
  const filtered = [...peers.filter((p) => p.with_games >= 2)]
    .sort((a, b) => b.with_games - a.with_games)
    .slice(0, 100)
  const rows = applySort(filtered, sortDir, (a, b) => {
    switch (sortKey) {
      case 'player':
        return (a.personaname ?? '').localeCompare(b.personaname ?? '')
      case 'wins':
        return a.with_win - b.with_win
      case 'winrate':
        return a.with_win / Math.max(1, a.with_games) - b.with_win / Math.max(1, b.with_games)
      case 'last':
        return a.last_played - b.last_played
      default:
        return a.with_games - b.with_games
    }
  })

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ background: C.panel }}>
        <span className="text-sm font-dota" style={{ color: C.dim }}>
          No teammate data available.
        </span>
      </div>
    )
  }

  return (
    <div className="font-dota" style={{ background: C.panel }}>
      {/* header */}
      <div
        className="flex items-center px-3 py-2.5 text-[12px] uppercase text-slate-muted-light"
        style={{ letterSpacing: '1px', background: C.panelDark }}
      >
        <SortHeader
          label="Player"
          sortKey="player"
          active={sortKey === 'player'}
          dir={sortDir}
          onClick={onSort}
          className="flex-1 min-w-0"
        />
        <div className="hidden sm:flex w-[110px] shrink-0 justify-center">
          <SortHeader
            label="Games"
            sortKey="games"
            active={sortKey === 'games'}
            dir={sortDir}
            onClick={onSort}
            className="justify-center"
          />
        </div>
        <div className="hidden md:flex w-[110px] shrink-0 justify-center">
          <SortHeader
            label="Wins"
            sortKey="wins"
            active={sortKey === 'wins'}
            dir={sortDir}
            onClick={onSort}
            className="justify-center"
          />
        </div>
        <SortHeader
          label="Win Rate"
          sortKey="winrate"
          active={sortKey === 'winrate'}
          dir={sortDir}
          onClick={onSort}
          className="w-[80px] sm:w-[110px] shrink-0 justify-center"
        />
        <div className="hidden md:flex w-[130px] shrink-0 justify-end pr-2">
          <SortHeader
            label="Last Played"
            sortKey="last"
            active={sortKey === 'last'}
            dir={sortDir}
            onClick={onSort}
            className="justify-end"
          />
        </div>
      </div>

      {rows.map((peer, i) => {
        const pct = peer.with_games > 0 ? (peer.with_win / peer.with_games) * 100 : 0
        return (
          <a
            key={peer.account_id}
            href={`/player/${peer.account_id}`}
            className="flex items-center px-3 hover:bg-white/[0.05] transition-colors"
            style={{ height: 52, background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {peer.avatarfull ? (
                <img
                  src={peer.avatarfull}
                  alt=""
                  className="shrink-0 object-cover rounded-full border border-slate-card"
                  style={{ width: 36, height: 36 }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="shrink-0 flex items-center justify-center rounded-full border border-slate-card"
                  style={{ width: 36, height: 36, background: '#20262a' }}
                >
                  <span style={{ fontSize: 16, color: C.dim }}>?</span>
                </div>
              )}
              <span className="text-[15px] truncate text-white">
                {peer.personaname ?? 'Anonymous'}
              </span>
            </div>

            <span className="hidden sm:block w-[110px] shrink-0 text-center text-[15px] tabular-nums text-slate-foreground">
              {peer.with_games}
            </span>
            <span className="hidden md:block w-[110px] shrink-0 text-center text-[15px] tabular-nums text-slate-foreground">
              {peer.with_win}
            </span>
            <span
              className={`w-[80px] sm:w-[110px] shrink-0 text-center text-[15px] tabular-nums ${wrStyle(pct).className}`}
              style={{ color: wrStyle(pct).color }}
            >
              {pct.toFixed(1)}%
            </span>
            <span
              className="hidden md:block w-[130px] shrink-0 text-right pr-2 text-[13px] tabular-nums"
              style={{ color: C.dim }}
            >
              {fmtDate(peer.last_played)}
            </span>
          </a>
        )
      })}
    </div>
  )
}
