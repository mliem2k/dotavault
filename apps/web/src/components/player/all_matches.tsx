import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState } from 'react'
import type { HeroStat, PlayerMatch } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import { opendota, type ProMatchRow } from '@/lib/opendota'
import { rankBadge, rankName } from '@/lib/rank'
import { applySort, useSort } from '@/lib/sortable'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

const PAGE_SIZE = 30

// Curated to the modes/lobbies players actually queue into (skips tutorial,
// diretide, greeviling, custom, etc.) — matches dotabuff/opendota's filters.
const GAME_MODE_OPTIONS: [number, string][] = [
  [1, 'All Pick'],
  [22, 'All Pick (Ranked)'],
  [2, 'Captains Mode'],
  [16, 'Captains Draft'],
  [17, 'Balanced Draft'],
  [3, 'Random Draft'],
  [4, 'Single Draft'],
  [5, 'All Random'],
  [20, 'All Random Deathmatch'],
  [18, 'Ability Draft'],
  [12, 'Least Played'],
  [21, '1v1 Mid'],
  [23, 'Turbo'],
]
const GAME_MODES: Record<number, string> = Object.fromEntries(GAME_MODE_OPTIONS)

const LOBBY_TYPE_OPTIONS: [number, string][] = [
  [0, 'Normal'],
  [7, 'Ranked'],
  [1, 'Practice'],
  [2, 'Tournament'],
  [8, '1v1 Mid'],
  [9, 'Battle Cup'],
  [14, 'New Player'],
]
const LOBBY_TYPES: Record<number, string> = Object.fromEntries(LOBBY_TYPE_OPTIONS)

const LANE_ROLE_OPTIONS: [number, string][] = [
  [1, 'Safe Lane'],
  [2, 'Mid Lane'],
  [3, 'Off Lane'],
  [4, 'Jungle'],
]

const DATE_OPTIONS: [number, string][] = [
  [7, 'Last 7 Days'],
  [30, 'Last 30 Days'],
  [90, 'Last 90 Days'],
  [182, 'Last 6 Months'],
  [365, 'Last Year'],
]

// Normalized shape both the regular matches endpoint and the Pro Only
// (SQL Explorer) query map into, so sorting/rendering doesn't care which
// source a row came from.
type Row = {
  match_id: number
  start_time: number
  duration: number
  hero_id: number
  kills: number
  deaths: number
  assists: number
  player_slot: number
  radiant_win: boolean
  gold_per_min: number | null
  xp_per_min: number | null
  last_hits: number | null
  average_rank: number | null
  typeLabel: string
}

function toRow(m: PlayerMatch): Row {
  return {
    match_id: m.match_id,
    start_time: m.start_time,
    duration: m.duration,
    hero_id: m.hero_id,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    player_slot: m.player_slot,
    radiant_win: m.radiant_win,
    gold_per_min: m.gold_per_min ?? null,
    xp_per_min: m.xp_per_min ?? null,
    last_hits: m.last_hits ?? null,
    average_rank: m.average_rank,
    typeLabel: LOBBY_TYPES[m.lobby_type] ?? GAME_MODES[m.game_mode] ?? '—',
  }
}

function toProRow(m: ProMatchRow): Row {
  return {
    match_id: m.match_id,
    start_time: m.start_time,
    duration: m.duration,
    hero_id: m.hero_id,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    player_slot: m.player_slot,
    radiant_win: m.radiant_win,
    gold_per_min: m.gold_per_min,
    xp_per_min: m.xp_per_min,
    last_hits: m.last_hits,
    average_rank: null,
    typeLabel: m.league_name ?? 'League',
  }
}

function isWin(m: Row): boolean {
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

function kda(m: Row): number {
  return (m.kills + m.assists) / Math.max(1, m.deaths)
}

type SortKey = 'date' | 'kda' | 'gpm' | 'xpm' | 'lh' | 'duration'
type ResultFilter = 'all' | 'win' | 'loss'
type SideFilter = 'all' | 'radiant' | 'dire'
type NumOrAll = number | 'all'

function selectStyle(disabled?: boolean): React.CSSProperties {
  return {
    background: '#14181b',
    color: '#cfd4d8',
    border: '1px solid #2c3236',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

export function AllMatches({
  accountId,
  heroStats,
}: {
  accountId: string
  heroStats: HeroStat[]
}) {
  const [heroFilter, setHeroFilter] = useState<NumOrAll>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [gameModeFilter, setGameModeFilter] = useState<NumOrAll>('all')
  const [lobbyTypeFilter, setLobbyTypeFilter] = useState<NumOrAll>('all')
  const [laneRoleFilter, setLaneRoleFilter] = useState<NumOrAll>('all')
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [dateFilter, setDateFilter] = useState<NumOrAll>('all')
  const [withHeroFilter, setWithHeroFilter] = useState<NumOrAll>('all')
  const [againstHeroFilter, setAgainstHeroFilter] = useState<NumOrAll>('all')
  const [withPlayerFilter, setWithPlayerFilter] = useState<NumOrAll>('all')
  const [proOnly, setProOnly] = useState(false)
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('date', 'desc')
  const navigate = useNavigate()

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const heroOptions = [...heroStats].sort((a, b) => a.localized_name.localeCompare(b.localized_name))

  // Peers list doubles as the "With Player" dropdown; also used by the
  // Teammates tab (same query key), so this reuses that cache when warm.
  const peers = useQuery({
    queryKey: ['player_peers', accountId],
    queryFn: () => opendota.playerPeers(accountId),
    staleTime: 10 * 60 * 1000,
  })
  const peerOptions = (peers.data ?? [])
    .filter((p) => p.with_games >= 2)
    .sort((a, b) => b.with_games - a.with_games)
    .slice(0, 100)

  const filtersActive =
    heroFilter !== 'all' ||
    resultFilter !== 'all' ||
    gameModeFilter !== 'all' ||
    lobbyTypeFilter !== 'all' ||
    laneRoleFilter !== 'all' ||
    sideFilter !== 'all' ||
    dateFilter !== 'all' ||
    withHeroFilter !== 'all' ||
    againstHeroFilter !== 'all' ||
    withPlayerFilter !== 'all' ||
    proOnly

  function resetFilters() {
    setHeroFilter('all')
    setResultFilter('all')
    setGameModeFilter('all')
    setLobbyTypeFilter('all')
    setLaneRoleFilter('all')
    setSideFilter('all')
    setDateFilter('all')
    setWithHeroFilter('all')
    setAgainstHeroFilter('all')
    setWithPlayerFilter('all')
    setProOnly(false)
  }

  // Pro Only replaces the source entirely (SQL Explorer join on leagues),
  // which can't compose with game mode / lobby / lane / side / with-hero /
  // against-hero / with-player — those selects are disabled while it's on.
  const query = useInfiniteQuery({
    queryKey: proOnly
      ? ['player_pro_matches', accountId, heroFilter, resultFilter, dateFilter]
      : [
          'player_all_matches',
          accountId,
          heroFilter,
          resultFilter,
          gameModeFilter,
          lobbyTypeFilter,
          laneRoleFilter,
          sideFilter,
          dateFilter,
          withHeroFilter,
          againstHeroFilter,
          withPlayerFilter,
        ],
    queryFn: ({ pageParam }) =>
      proOnly
        ? opendota
            .playerProMatches(accountId, {
              limit: PAGE_SIZE,
              offset: pageParam,
              heroId: heroFilter === 'all' ? undefined : heroFilter,
              win: resultFilter === 'all' ? undefined : resultFilter === 'win' ? 1 : 0,
              date: dateFilter === 'all' ? undefined : dateFilter,
            })
            .then((rows) => rows.map(toProRow))
        : opendota
            .playerMatches(accountId, {
              limit: PAGE_SIZE,
              offset: pageParam,
              heroId: heroFilter === 'all' ? undefined : heroFilter,
              win: resultFilter === 'all' ? undefined : resultFilter === 'win' ? 1 : 0,
              gameMode: gameModeFilter === 'all' ? undefined : gameModeFilter,
              lobbyType: lobbyTypeFilter === 'all' ? undefined : lobbyTypeFilter,
              laneRole: laneRoleFilter === 'all' ? undefined : laneRoleFilter,
              isRadiant: sideFilter === 'all' ? undefined : sideFilter === 'radiant' ? 1 : 0,
              date: dateFilter === 'all' ? undefined : dateFilter,
              withHeroId: withHeroFilter === 'all' ? undefined : withHeroFilter,
              againstHeroId: againstHeroFilter === 'all' ? undefined : againstHeroFilter,
              includedAccountId: withPlayerFilter === 'all' ? undefined : withPlayerFilter,
              // Any `project` param switches OpenDota into custom-projection
              // mode, returning ONLY these fields (plus match_id/player_slot/
              // radiant_win/duration/game_mode/lobby_type) — every field the
              // table needs must be listed explicitly or it silently comes
              // back undefined.
              project: [
                'hero_id', 'start_time', 'version', 'kills', 'deaths', 'assists',
                'average_rank', 'gold_per_min', 'xp_per_min', 'last_hits',
              ],
            })
            .then((rows) => rows.map(toRow)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE),
    staleTime: 60 * 1000,
  })

  const matches = query.data ? query.data.pages.flat() : []
  const sorted = applySort(matches, sortDir, (a, b) => {
    switch (sortKey) {
      case 'kda':
        return kda(a) - kda(b)
      case 'gpm':
        return (a.gold_per_min ?? 0) - (b.gold_per_min ?? 0)
      case 'xpm':
        return (a.xp_per_min ?? 0) - (b.xp_per_min ?? 0)
      case 'lh':
        return (a.last_hits ?? 0) - (b.last_hits ?? 0)
      case 'duration':
        return a.duration - b.duration
      default:
        return a.start_time - b.start_time
    }
  })

  // Windows the row list instead of rendering every loaded match's DOM node —
  // heavy users can load thousands of rows across "Load More" clicks.
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 46,
    overscan: 8,
  })

  return (
    <div className="max-w-[1100px]" style={{ background: 'rgba(16,19,22,0.72)', fontFamily: 'var(--font-dota)' }}>
      {/* Filter toolbar */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 flex-wrap"
        style={{ background: 'rgba(8,10,12,0.7)' }}
      >
        <select
          value={heroFilter}
          onChange={(e) => setHeroFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle()}
        >
          <option value="all">My Hero</option>
          {heroOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.localized_name}
            </option>
          ))}
        </select>

        <select
          value={withHeroFilter}
          disabled={proOnly}
          onChange={(e) => setWithHeroFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">With Hero</option>
          {heroOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.localized_name}
            </option>
          ))}
        </select>

        <select
          value={againstHeroFilter}
          disabled={proOnly}
          onChange={(e) => setAgainstHeroFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">Against Hero</option>
          {heroOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.localized_name}
            </option>
          ))}
        </select>

        <select
          value={withPlayerFilter}
          disabled={proOnly}
          onChange={(e) => setWithPlayerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">With Player</option>
          {peerOptions.map((p) => (
            <option key={p.account_id} value={p.account_id}>
              {p.personaname ?? `#${p.account_id}`}
            </option>
          ))}
        </select>

        <select
          value={gameModeFilter}
          disabled={proOnly}
          onChange={(e) => setGameModeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">All Modes</option>
          {GAME_MODE_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={lobbyTypeFilter}
          disabled={proOnly}
          onChange={(e) => setLobbyTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">All Lobbies</option>
          {LOBBY_TYPE_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={laneRoleFilter}
          disabled={proOnly}
          onChange={(e) => setLaneRoleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">All Roles</option>
          {LANE_ROLE_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={sideFilter}
          disabled={proOnly}
          onChange={(e) => setSideFilter(e.target.value as SideFilter)}
          className="text-[13px] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle(proOnly)}
        >
          <option value="all">Any Side</option>
          <option value="radiant">Radiant</option>
          <option value="dire">Dire</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-[13px] px-2 py-1.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={selectStyle()}
        >
          <option value="all">All Time</option>
          {DATE_OPTIONS.map(([days, label]) => (
            <option key={days} value={days}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex items-center" style={{ border: '1px solid #2c3236' }}>
          {(['all', 'win', 'loss'] as ResultFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResultFilter(r)}
              className="px-3 py-1.5 text-[12px] uppercase cursor-pointer transition-colors"
              style={{
                background: resultFilter === r ? '#2c3236' : 'transparent',
                color: resultFilter === r ? '#ffffff' : '#8a97a0',
                letterSpacing: '1px',
              }}
            >
              {r === 'all' ? 'All' : r === 'win' ? 'Won' : 'Lost'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setProOnly((v) => !v)}
          className="px-3 py-1.5 text-[12px] uppercase cursor-pointer transition-colors"
          style={{
            background: proOnly ? 'rgba(201,169,74,0.15)' : 'transparent',
            color: proOnly ? '#c9a94a' : '#8a97a0',
            border: `1px solid ${proOnly ? '#c9a94a' : '#2c3236'}`,
            letterSpacing: '1px',
          }}
        >
          Pro Only
        </button>

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-[12px] uppercase cursor-pointer hover:text-white"
            style={{ color: '#67757f', letterSpacing: '1px' }}
          >
            Reset Filters
          </button>
        )}

        <span className="text-[12px] ml-auto" style={{ color: '#67757f' }}>
          {matches.length.toLocaleString()} loaded
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header row */}
          <div
            className="flex items-center px-3 py-2.5 text-[12px] uppercase"
            style={{ color: '#8a97a0', letterSpacing: '1px', background: 'rgba(8,10,12,0.55)' }}
          >
            <SortHeader
              label="Date / Time"
              sortKey="date"
              active={sortKey === 'date'}
              dir={sortDir}
              onClick={onSort}
              className="w-[150px] shrink-0"
            />
            <span className="flex-1 min-w-0">Hero Played</span>
            <span className="w-[70px] shrink-0 text-center">Rank</span>
            <span className="w-[90px] shrink-0 text-center">Result</span>
            <SortHeader
              label="K / D / A"
              sortKey="kda"
              active={sortKey === 'kda'}
              dir={sortDir}
              onClick={onSort}
              className="w-[110px] shrink-0 justify-end"
            />
            <div className="hidden sm:flex w-[60px] shrink-0 justify-end">
              <SortHeader label="GPM" sortKey="gpm" active={sortKey === 'gpm'} dir={sortDir} onClick={onSort} className="justify-end" />
            </div>
            <div className="hidden sm:flex w-[60px] shrink-0 justify-end">
              <SortHeader label="XPM" sortKey="xpm" active={sortKey === 'xpm'} dir={sortDir} onClick={onSort} className="justify-end" />
            </div>
            <div className="hidden md:flex w-[50px] shrink-0 justify-end">
              <SortHeader label="LH" sortKey="lh" active={sortKey === 'lh'} dir={sortDir} onClick={onSort} className="justify-end" />
            </div>
            <SortHeader
              label="Duration"
              sortKey="duration"
              active={sortKey === 'duration'}
              dir={sortDir}
              onClick={onSort}
              className="w-[80px] shrink-0 justify-end"
            />
            <span className="hidden sm:block w-[90px] shrink-0 text-right pr-2">Type</span>
          </div>

          {query.isPending ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-[13px]" style={{ color: '#67757f' }}>
              No matches found for this filter.
            </div>
          ) : (
            // Virtualized row list — windows the DOM to the visible rows so
            // repeated "Load More" clicks don't grow the page linearly.
            <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 640 }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const m = sorted[vRow.index]
                  const hero = heroMap.get(m.hero_id)
                  const won = isWin(m)
                  const { d, t } = fmtDate(m.start_time)
                  const badge = rankBadge(m.average_rank)
                  const goToMatch = () => navigate({ to: '/match/$matchId', params: { matchId: String(m.match_id) } })

                  return (
                    <div
                      key={m.match_id}
                      role="button"
                      tabIndex={0}
                      onClick={goToMatch}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goToMatch()
                        }
                      }}
                      className="flex items-center px-3 hover:bg-white/[0.05] transition-colors cursor-pointer"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: vRow.size,
                        transform: `translateY(${vRow.start}px)`,
                        background: vRow.index % 2 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <div className="w-[150px] shrink-0 text-[13px] tabular-nums" style={{ color: '#e8ecef' }}>
                        {d} <span style={{ color: '#8a97a0' }}>{t}</span>
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        {hero && (
                          <a href={`/hero/${heroSlug(hero.localized_name)}`} onClick={(e) => e.stopPropagation()} className="shrink-0 block">
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
                            onClick={(e) => e.stopPropagation()}
                            className="text-[14px] truncate hover:underline"
                            style={{ color: '#e8ecef' }}
                          >
                            {hero.localized_name}
                          </a>
                        ) : (
                          <span className="text-[14px] truncate" style={{ color: '#e8ecef' }}>
                            {`Hero ${m.hero_id}`}
                          </span>
                        )}
                      </div>

                      <div className="w-[70px] shrink-0 flex items-center justify-center" title={rankName(m.average_rank)}>
                        {badge ? (
                          <img src={badge.medal} alt="" style={{ width: 24, height: 24 }} className="object-contain" />
                        ) : (
                          <span style={{ color: '#4d565c' }}>—</span>
                        )}
                      </div>

                      <div className="w-[90px] shrink-0 text-center">
                        <span
                          className="text-[14px] uppercase"
                          style={{ color: won ? '#8fbf3f' : '#d14a38', letterSpacing: '1px' }}
                        >
                          {won ? 'Won' : 'Lost'}
                        </span>
                      </div>

                      <div className="w-[110px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#e8ecef' }}>
                        {m.kills} / {m.deaths} / {m.assists}
                      </div>

                      <div className="hidden sm:block w-[60px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#cfd4d8' }}>
                        {m.gold_per_min ?? '—'}
                      </div>

                      <div className="hidden sm:block w-[60px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#cfd4d8' }}>
                        {m.xp_per_min ?? '—'}
                      </div>

                      <div className="hidden md:block w-[50px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#cfd4d8' }}>
                        {m.last_hits ?? '—'}
                      </div>

                      <div className="w-[80px] shrink-0 text-right text-[13px] tabular-nums" style={{ color: '#e8ecef' }}>
                        {fmtDur(m.duration)}
                      </div>

                      <div className="hidden sm:block w-[90px] shrink-0 text-right text-[13px] pr-2 truncate" style={{ color: '#cfd4d8' }} title={m.typeLabel}>
                        {m.typeLabel}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {query.hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="inline-flex items-center justify-center min-h-[44px] px-6 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-50"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: '#cfd4d8', letterSpacing: '1px' }}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
