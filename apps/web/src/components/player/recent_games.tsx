import { Link } from '@tanstack/react-router'
import type { HeroStat, PlayerMatch } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

const GAME_MODES: Record<number, string> = {
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  16: 'Captains Draft',
  22: 'Ranked',
  23: 'Turbo',
}

const LOBBY_TYPES: Record<number, string> = {
  0: 'Normal',
  1: 'Practice',
  5: 'Team',
  6: 'Tournament',
  7: 'Ranked',
  9: 'Battle Cup',
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
    <div className="font-dota" style={{ background: 'rgba(16,19,22,0.72)' }}>
      {/* header */}
      <div
        className="flex items-center px-3 py-2.5 text-[12px] uppercase text-slate-muted-light"
        style={{ letterSpacing: '1px', background: 'rgba(8,10,12,0.7)' }}
      >
        <div className="hidden sm:flex w-[150px] shrink-0">
          <SortHeader
            label="Date / Time"
            sortKey="date"
            active={sortKey === 'date'}
            dir={sortDir}
            onClick={onSort}
          />
        </div>
        <SortHeader
          label="Hero Played"
          sortKey="hero"
          active={sortKey === 'hero'}
          dir={sortDir}
          onClick={onSort}
          className="flex-1 min-w-0"
        />
        <SortHeader
          label="Result"
          sortKey="result"
          active={sortKey === 'result'}
          dir={sortDir}
          onClick={onSort}
          className="w-[80px] sm:w-[110px] shrink-0 justify-center"
        />
        <SortHeader
          label="Duration"
          sortKey="duration"
          active={sortKey === 'duration'}
          dir={sortDir}
          onClick={onSort}
          className="w-[60px] sm:w-[80px] shrink-0 justify-end"
        />
        <div className="hidden sm:flex w-[90px] shrink-0 justify-end pr-2">
          <SortHeader
            label="Type"
            sortKey="type"
            active={sortKey === 'type'}
            dir={sortDir}
            onClick={onSort}
            className="justify-end"
          />
        </div>
      </div>

      {sorted.map((m, i) => {
        const hero = heroMap.get(m.hero_id)
        const won = isWin(m)
        const { d, t } = fmtDate(m.start_time)
        const type = LOBBY_TYPES[m.lobby_type] ?? GAME_MODES[m.game_mode] ?? '—'

        return (
          <div
            key={m.match_id}
            className="relative flex items-center px-3 hover:bg-white/[0.05] transition-colors"
            style={{ height: 46, background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          >
            {/* Stretched link: whole row is a real, ctrl+click/middle-click openable
                link to the match, without nesting an <a> inside an <a> around the
                hero links below (invalid HTML). z-0 vs the hero links' z-10 keeps
                those independently clickable on top of it. */}
            <Link
              to="/match/$matchId"
              params={{ matchId: String(m.match_id) }}
              className="absolute inset-0 z-0"
              aria-label={`View match played ${d} ${t}`}
            />
            <div className="hidden sm:block w-[150px] shrink-0 text-[13px] tabular-nums pointer-events-none text-slate-foreground-light">
              {d} <span className="text-slate-muted-light">{t}</span>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              {hero && (
                <a
                  href={`/hero/${heroSlug(hero.localized_name)}`}
                  className="relative z-10 shrink-0 block"
                >
                  <img
                    src={heroLandscapeUrl(hero.name)}
                    alt=""
                    className="object-cover"
                    style={{ width: 58, height: 33 }}
                    onError={cdnFallback(heroLandscapeCdn(hero.name))}
                  />
                </a>
              )}
              {hero ? (
                <a
                  href={`/hero/${heroSlug(hero.localized_name)}`}
                  className="relative z-10 text-[14px] truncate hover:underline text-slate-foreground-light"
                >
                  {hero.localized_name}
                </a>
              ) : (
                <span className="text-[14px] truncate pointer-events-none text-slate-foreground-light">
                  {`Hero ${m.hero_id}`}
                </span>
              )}
              {leagueByMatchId.get(m.match_id) && (
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[11px] font-bold uppercase truncate max-w-[220px] text-gold"
                  style={{
                    background: 'rgba(201,169,74,0.12)',
                    letterSpacing: '0.5px',
                  }}
                  title={leagueByMatchId.get(m.match_id)?.league_name ?? undefined}
                >
                  {leagueByMatchId.get(m.match_id)?.league_name ?? 'Tournament'}
                </span>
              )}
            </div>

            <div className="w-[80px] sm:w-[110px] shrink-0 text-center pointer-events-none">
              <span
                className={`text-[14px] uppercase ${won ? '' : 'text-dire'}`}
                style={{ color: won ? '#8fbf3f' : undefined, letterSpacing: '1px' }}
              >
                {won ? 'Won' : 'Lost'}
              </span>
            </div>

            <div className="w-[60px] sm:w-[80px] shrink-0 text-right text-[13px] tabular-nums pointer-events-none text-slate-foreground-light">
              {fmtDur(m.duration)}
            </div>

            <div className="hidden sm:block w-[90px] shrink-0 text-right text-[13px] pr-2 pointer-events-none text-slate-foreground">
              {type}
            </div>
          </div>
        )
      })}
    </div>
  )
}
