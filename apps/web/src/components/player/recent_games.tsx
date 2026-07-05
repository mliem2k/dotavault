import type { HeroStat, PlayerMatch } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl } from '@/lib/utils'

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

type SortKey = 'date' | 'hero' | 'result' | 'duration' | 'type'

export function RecentGames({
  matches,
  heroStats,
  leagueInfo,
}: {
  matches: PlayerMatch[]
  heroStats: HeroStat[]
  leagueInfo?: { match_id: number; leagueid: number; league_name: string | null }[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const leagueByMatchId = new Map((leagueInfo ?? []).map((l) => [l.match_id, l]))
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('date', 'desc')

  const sorted = applySort(matches, sortDir, (a, b) => {
    switch (sortKey) {
      case 'hero':
        return (heroMap.get(a.hero_id)?.localized_name ?? '').localeCompare(
          heroMap.get(b.hero_id)?.localized_name ?? '',
        )
      case 'result':
        return Number(isWin(a)) - Number(isWin(b))
      case 'duration':
        return a.duration - b.duration
      case 'type':
        return (LOBBY_TYPES[a.lobby_type] ?? GAME_MODES[a.game_mode] ?? '').localeCompare(
          LOBBY_TYPES[b.lobby_type] ?? GAME_MODES[b.game_mode] ?? '',
        )
      default:
        return a.start_time - b.start_time
    }
  })

  return (
    <div style={{ background: 'rgba(16,19,22,0.72)', fontFamily: 'var(--font-dota)' }}>
      {/* header */}
      <div
        className="flex items-center px-3 py-2.5 text-[12px] uppercase"
        style={{ color: '#8a97a0', letterSpacing: '1px', background: 'rgba(8,10,12,0.7)' }}
      >
        <SortHeader label="Date / Time" sortKey="date" active={sortKey === 'date'} dir={sortDir} onClick={onSort} className="w-[150px] shrink-0" />
        <SortHeader label="Hero Played" sortKey="hero" active={sortKey === 'hero'} dir={sortDir} onClick={onSort} className="flex-1 min-w-0" />
        <SortHeader label="Result" sortKey="result" active={sortKey === 'result'} dir={sortDir} onClick={onSort} className="w-[110px] shrink-0 justify-center" />
        <SortHeader label="Duration" sortKey="duration" active={sortKey === 'duration'} dir={sortDir} onClick={onSort} className="w-[80px] shrink-0 justify-end" />
        <SortHeader label="Type" sortKey="type" active={sortKey === 'type'} dir={sortDir} onClick={onSort} className="w-[90px] shrink-0 justify-end pr-2" />
        <span className="w-[24px] shrink-0 text-right" style={{ color: '#67757f' }}>⚙</span>
      </div>

      {sorted.map((m, i) => {
        const hero = heroMap.get(m.hero_id)
        const won = isWin(m)
        const { d, t } = fmtDate(m.start_time)
        const type = LOBBY_TYPES[m.lobby_type] ?? GAME_MODES[m.game_mode] ?? '—'

        return (
          <a
            key={m.match_id}
            href={`/match/${m.match_id}`}
            className="flex items-center px-3 hover:bg-white/[0.05] transition-colors"
            style={{ height: 46, background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          >
            <div className="w-[150px] shrink-0 text-[13px] tabular-nums" style={{ color: '#e8ecef' }}>
              {d} <span style={{ color: '#8a97a0' }}>{t}</span>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              {hero && (
                <img
                  src={heroLandscapeUrl(hero.name)}
                  alt=""
                  className="shrink-0 object-cover"
                  style={{ width: 58, height: 33 }}
                  onError={cdnFallback(heroLandscapeCdn(hero.name))}
                />
              )}
              <span className="text-[14px] truncate" style={{ color: '#e8ecef' }}>
                {hero?.localized_name ?? `Hero ${m.hero_id}`}
              </span>
              {leagueByMatchId.get(m.match_id) && (
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[11px] font-bold uppercase truncate max-w-[220px]"
                  style={{ background: 'rgba(201,169,74,0.12)', color: '#c9a94a', letterSpacing: '0.5px' }}
                  title={leagueByMatchId.get(m.match_id)?.league_name ?? undefined}
                >
                  {leagueByMatchId.get(m.match_id)?.league_name ?? 'Tournament'}
                </span>
              )}
            </div>

            <div className="w-[110px] shrink-0 text-center">
              <span className="text-[14px] uppercase" style={{ color: won ? '#8fbf3f' : '#c94a38', letterSpacing: '1px' }}>
                {won ? 'Won' : 'Lost'}
              </span>
            </div>

            <div className="w-[80px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#e8ecef' }}>
              {fmtDur(m.duration)}
            </div>

            <div className="w-[90px] shrink-0 text-right text-[13px] pr-2" style={{ color: '#cfd4d8' }}>
              {type}
            </div>
            <div className="w-[24px] shrink-0" />
          </a>
        )
      })}
    </div>
  )
}
