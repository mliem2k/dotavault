import type { HeroStat, PlayerMatch } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

const GAME_MODES: Record<number, string> = {
  1: 'All Pick', 2: 'Captains Mode', 3: 'Random Draft', 4: 'Single Draft',
  5: 'All Random', 16: 'Captains Draft', 22: 'Ranked', 23: 'Turbo',
}

const LOBBY_TYPES: Record<number, string> = {
  0: 'Normal', 1: 'Practice', 5: 'Team', 6: 'Tournament', 7: 'Ranked', 9: 'Battle Cup',
}

function isWin(m: PlayerMatch): boolean {
  const radiant = m.player_slot < 128
  return radiant === m.radiant_win
}

function fmtDate(unix: number): { d: string; t: string } {
  const dt = new Date(unix * 1000)
  const d = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`
  const t = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return { d, t }
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RecentGames({
  matches,
  heroStats,
}: {
  matches: PlayerMatch[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))

  return (
    <div style={{ background: '#100e0b', border: '1px solid #1c1810' }}>
      {/* header */}
      <div
        className="flex items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: '#77715f', fontFamily: 'var(--font-dota)', borderBottom: '1px solid #241f16' }}
      >
        <span className="w-[120px] shrink-0">Date / Time</span>
        <span className="flex-1 min-w-0">Hero</span>
        <span className="w-[90px] shrink-0 text-center">Result</span>
        <span className="w-[90px] shrink-0 text-center">K / D / A</span>
        <span className="w-[70px] shrink-0 text-right">Duration</span>
        <span className="w-[90px] shrink-0 text-right">Type</span>
      </div>

      {matches.map((m, i) => {
        const hero = heroMap.get(m.hero_id)
        const won = isWin(m)
        const { d, t } = fmtDate(m.start_time)
        const heroShort = hero?.name.replace('npc_dota_hero_', '') ?? String(m.hero_id)
        const type = LOBBY_TYPES[m.lobby_type] ?? GAME_MODES[m.game_mode] ?? '—'

        return (
          <a
            key={m.match_id}
            href={`/match/${m.match_id}`}
            className="flex items-center px-3 hover:bg-white/[0.03] transition-colors"
            style={{ height: 44, borderBottom: '1px solid #17140f', background: i % 2 ? '#0e0c0a' : 'transparent' }}
          >
            <div className="w-[120px] shrink-0" style={{ fontFamily: 'var(--font-dota)' }}>
              <div className="text-[12px]" style={{ color: '#c8c2b4' }}>{d}</div>
              <div className="text-[10px]" style={{ color: '#5a5446' }}>{t}</div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              {hero && (
                <img
                  src={heroIconUrl(hero.name)}
                  alt=""
                  className="w-8 h-8 rounded shrink-0"
                  onError={(e) => {
                    const img = e.currentTarget
                    img.onerror = null
                    img.src = heroIconFromPath(hero.icon)
                  }}
                />
              )}
              <span className="text-[13px] truncate" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                {hero?.localized_name ?? `Hero ${m.hero_id}`}
              </span>
            </div>

            <div className="w-[90px] shrink-0 text-center">
              <span
                className="text-[13px] font-bold uppercase tracking-wide"
                style={{ color: won ? '#8ec63f' : '#d14a38', fontFamily: 'var(--font-dota)' }}
              >
                {won ? 'Won' : 'Lost'}
              </span>
            </div>

            <div className="w-[90px] shrink-0 text-center text-[13px] tabular-nums" style={{ fontFamily: 'var(--font-dota)' }}>
              <span style={{ color: '#57c262' }}>{m.kills}</span>
              <span style={{ color: '#5a5446' }}> / </span>
              <span style={{ color: '#e07a5a' }}>{m.deaths}</span>
              <span style={{ color: '#5a5446' }}> / </span>
              <span style={{ color: '#c9b88a' }}>{m.assists}</span>
            </div>

            <div className="w-[70px] shrink-0 text-right text-[12px] tabular-nums" style={{ color: '#a8a08c', fontFamily: 'var(--font-dota)' }}>
              {fmtDur(m.duration)}
            </div>

            <div className="w-[90px] shrink-0 text-right text-[11px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
              {type}
            </div>
          </a>
        )
      })}
    </div>
  )
}
