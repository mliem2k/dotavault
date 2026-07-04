const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#8fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

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

function wrColor(pct: number): string {
  return pct >= 50 ? C.green : C.red
}

export function Teammates({ peers }: { peers: Peer[] }) {
  const rows = peers
    .filter((p) => p.with_games >= 2)
    .sort((a, b) => b.with_games - a.with_games)
    .slice(0, 40)

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ background: C.panel }}>
        <span className="text-sm" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
          No teammate data available.
        </span>
      </div>
    )
  }

  return (
    <div style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
      {/* header */}
      <div
        className="flex items-center px-3 py-2.5 text-[12px] uppercase"
        style={{ color: C.label, letterSpacing: '1px', background: C.panelDark }}
      >
        <span className="flex-1 min-w-0">Player</span>
        <span className="w-[110px] shrink-0 text-center">Games</span>
        <span className="w-[110px] shrink-0 text-center">Wins</span>
        <span className="w-[110px] shrink-0 text-center">Win Rate</span>
        <span className="w-[130px] shrink-0 text-right pr-2">Last Played</span>
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
                  className="shrink-0 object-cover"
                  style={{ width: 36, height: 36, border: '1px solid #2c3236' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: 36, height: 36, background: '#20262a', border: '1px solid #2c3236' }}
                >
                  <span style={{ fontSize: 16, color: C.dim }}>?</span>
                </div>
              )}
              <span className="text-[15px] truncate" style={{ color: C.white }}>
                {peer.personaname ?? 'Anonymous'}
              </span>
            </div>

            <span className="w-[110px] shrink-0 text-center text-[15px] tabular-nums" style={{ color: C.text }}>
              {peer.with_games}
            </span>
            <span className="w-[110px] shrink-0 text-center text-[15px] tabular-nums" style={{ color: C.text }}>
              {peer.with_win}
            </span>
            <span className="w-[110px] shrink-0 text-center text-[15px] tabular-nums" style={{ color: wrColor(pct) }}>
              {pct.toFixed(1)}%
            </span>
            <span className="w-[130px] shrink-0 text-right pr-2 text-[13px] tabular-nums" style={{ color: C.dim }}>
              {fmtDate(peer.last_played)}
            </span>
          </a>
        )
      })}
    </div>
  )
}
