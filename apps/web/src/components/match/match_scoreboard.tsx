import { type JSX, memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { AbilityIcon } from './ability_icon'
import { ItemIcon } from './item_icon'
import { MatchRosterSidebar, orderedTeams, useRosterMetrics } from './match_roster'
import {
  GameTimeSlider,
  damageHealAtTime,
  hasMoonshardBuff,
  hasScepterBuff,
  hasShardBuff,
  hasTimeline,
  itemsAtTime,
  statsAtTime,
  teamScoreAtTime,
  type TimedStats,
} from './match_time'

type SortKey = 'kills' | 'deaths' | 'assists' | 'networth' | 'lh' | 'gpm' | 'xpm' | 'dmg' | 'heal' | 'bld' | 'wards'

function wardsAtTime(p: MatchPlayer, timeSec: number): number {
  const obs = p.obs_log ? p.obs_log.filter((w) => w.time <= timeSec).length : (p.obs_placed ?? 0)
  const sen = p.sen_log ? p.sen_log.filter((w) => w.time <= timeSec).length : (p.sen_placed ?? 0)
  return obs + sen
}

function sortValue(
  p: MatchPlayer,
  key: SortKey,
  timed: TimedStats,
  match: Match,
  timeSec: number,
): number {
  switch (key) {
    case 'kills':
      return timed.kills
    case 'deaths':
      return timed.deaths
    case 'assists':
      return timed.assists
    case 'networth':
      return timed.netWorth
    case 'lh':
      return timed.lastHits
    case 'gpm':
      return timed.gpm
    case 'xpm':
      return timed.xpm
    case 'dmg':
      return p.hero_damage != null ? damageHealAtTime(match, p, timeSec).damage : -1
    case 'heal':
      return p.hero_healing != null ? damageHealAtTime(match, p, timeSec).healing : -1
    case 'bld':
      return p.tower_damage ?? -1
    case 'wards':
      return wardsAtTime(p, timeSec)
  }
}

const SIDEBAR_W = 272
const SIDEBAR_W_MOBILE = 140
const MOBILE_QUERY = '(max-width: 640px)'

/* Responsive sidebar width: the roster sidebar sits outside the stats pane's
   own horizontal scroll, so on narrow viewports it must shrink instead of
   permanently eating most of the screen. */
function useSidebarWidth(): number {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow ? SIDEBAR_W_MOBILE : SIDEBAR_W
}

type Abilities = Record<string, AbilityConst>
type AbilityIds = Record<string, string>

// Items counted in the "Support Items" column (wards, consumables, utility).
const SUPPORT_ITEMS = new Set([
  'ward_observer', 'ward_sentry', 'ward_dispenser', 'dust', 'smoke_of_deceit', 'tpscroll',
  'flask', 'clarity', 'tango', 'tango_single', 'enchanted_mango', 'faerie_fire', 'gem',
  'infused_raindrop', 'bottle', 'blood_grenade', 'cheese',
])

const GoldPip = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" className="inline-block shrink-0 -mt-0.5">
    <circle cx="5" cy="5" r="4.5" fill="#e5b12c" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#5a4106" fontWeight="bold">$</text>
  </svg>
)

function fmtK(v: number | null | undefined): string {
  const n = v ?? 0
  return n.toLocaleString()
}

const num = (color: string, size = 16, weight = 400) => (v: number | string) => (
  <span className="tabular-nums" style={{ color, fontSize: size, fontWeight: weight, fontFamily: 'var(--font-dota)' }}>{v}</span>
)

/* Support items purchased + total gold spent on them. */
function SupportItemsGroup({
  player,
  itemConst,
  timeSec,
  duration,
}: {
  player: MatchPlayer
  itemConst: Record<string, ItemConst>
  timeSec: number
  duration: number
}) {
  const atEnd = timeSec >= duration
  const counts = new Map<string, number>()
  for (const e of player.purchase_log ?? []) {
    if (SUPPORT_ITEMS.has(e.key) && (atEnd || e.time <= timeSec)) counts.set(e.key, (counts.get(e.key) ?? 0) + 1)
  }
  const entries = [...counts.entries()]
  const gold = entries.reduce((s, [name, n]) => s + n * (itemConst[name]?.cost ?? 0), 0)

  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0" style={{ minWidth: 250 }}>
      <div className="flex items-center gap-1.5 flex-1">
        {entries.map(([name, n]) => (
          <div key={name} className="relative shrink-0">
            <ItemIcon name={name} meta={itemConst[name]} width={32} height={24} />
            {n > 1 && (
              <span
                className="absolute -bottom-1 -right-1 text-[10px] px-0.5 tabular-nums"
                style={{ background: '#0a0c0e', color: '#e8ecef', fontFamily: 'var(--font-dota)' }}
              >
                x{n}
              </span>
            )}
          </div>
        ))}
      </div>
      <span className="w-14 text-right text-[15px] tabular-nums" style={{ color: '#f2c94c', fontFamily: 'var(--font-dota)' }}>
        {gold > 0 ? gold.toLocaleString() : '0'}
      </span>
    </div>
  )
}

/* Permanent upgrades (Aghanim's Scepter/Shard, Moon Shard) — final state
   only, not time-scrubbed, since these are "did they ever get this" facts
   rather than a snapshot of current inventory. */
function BuffsGroup({
  player,
  idToName,
  itemConst,
}: {
  player: MatchPlayer
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
}) {
  const names = [
    hasScepterBuff(player, idToName) ? 'ultimate_scepter' : null,
    hasShardBuff(player, idToName) ? 'aghanims_shard' : null,
    hasMoonshardBuff(player) ? 'moon_shard' : null,
  ].filter((n): n is string => n != null)

  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0">
      {names.map((name) => (
        <ItemIcon key={name} name={name} meta={itemConst[name]} width={32} height={24} />
      ))}
    </div>
  )
}

/* Ability upgrade order (skill build). */
function AbilityBuildGroup({
  player,
  abilities,
  abilityIds,
  maxLevel,
}: {
  player: MatchPlayer
  abilities: Abilities
  abilityIds: AbilityIds
  maxLevel: number
}) {
  // Skill points are taken one per level, so the build at time T is simply
  // the first `level at T` upgrades.
  const arr = (player.ability_upgrades_arr ?? []).slice(0, maxLevel)
  return (
    <div className="flex items-center gap-[3px] px-2 shrink-0">
      {arr.map((id, i) => {
        const name = abilityIds[String(id)] ?? ''
        const isTalent = name.startsWith('special_bonus')
        return (
          <AbilityIcon key={i} name={name} meta={abilities[name]} isTalent={isTalent} level={i + 1} />
        )
      })}
    </div>
  )
}

type Col = {
  label: string
  width: number
  align?: 'center' | 'right'
  sortKey?: SortKey
  render: (p: MatchPlayer, t: TimedStats) => JSX.Element
}

function ItemsCell({
  player,
  idToName,
  itemConst,
  timeSec,
  duration,
}: {
  player: MatchPlayer
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  timeSec: number
  duration: number
}) {
  const items = itemsAtTime(player, idToName, timeSec, duration, itemConst)
  return (
    <div className="flex gap-[3px]">
      {items.map((id, i) => {
        const name = id ? (idToName.get(id) ?? null) : null
        return (
          <ItemIcon key={i} name={name} meta={name ? itemConst[name] : undefined} width={36} height={27} />
        )
      })}
    </div>
  )
}

/* One player row: rendered per side, memoized so selecting a row doesn't
   force every other row to recompute its stats. The row itself is the
   interactive toggle target; a div with role="row" (for table semantics),
   tabIndex, aria-pressed, and manual key handling gives the same
   keyboard/AT behavior a real <button> would. */
const PlayerRow = memo(function PlayerRow({
  player,
  active,
  onSelect,
  cols,
  heroMap,
  allPlayers,
  timeSec,
  duration,
  hasPurchases,
  hasBuffs,
  maxAbilities,
  idToName,
  itemConst,
  abilities,
  abilityIds,
  rowH,
}: {
  player: MatchPlayer
  active: boolean
  onSelect: (slot: number) => void
  cols: Col[]
  heroMap: Map<number, HeroStat>
  allPlayers: MatchPlayer[]
  timeSec: number
  duration: number
  hasPurchases: boolean
  hasBuffs: boolean
  maxAbilities: number
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  abilities: Abilities
  abilityIds: AbilityIds
  rowH: number
}) {
  const timed = statsAtTime(player, allPlayers, heroMap.get(player.hero_id)?.name ?? '', timeSec, duration)

  const toggle = () => onSelect(player.player_slot)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div
      role="row"
      tabIndex={0}
      aria-pressed={active}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className="flex items-stretch w-full text-left cursor-pointer hover:bg-white/[0.04]"
      style={{ height: rowH, background: active ? 'rgba(255,255,255,0.13)' : undefined, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      {cols.map((c, i) => (
        <div
          key={i}
          role="cell"
          className={`shrink-0 flex items-center ${i === 4 ? 'justify-start pl-1' : 'justify-center'}`}
          style={{ width: c.width }}
        >
          {c.render(player, timed)}
        </div>
      ))}
      {hasPurchases && (
        <div role="cell" className="flex items-center shrink-0">
          <SupportItemsGroup player={player} itemConst={itemConst} timeSec={timeSec} duration={duration} />
        </div>
      )}
      {hasBuffs && (
        <div role="cell" className="flex items-center shrink-0">
          <BuffsGroup player={player} idToName={idToName} itemConst={itemConst} />
        </div>
      )}
      {maxAbilities > 0 && (
        <div role="cell" className="flex items-center shrink-0">
          <AbilityBuildGroup player={player} abilities={abilities} abilityIds={abilityIds} maxLevel={timed.level} />
        </div>
      )}
    </div>
  )
})

export function MatchScoreboard({
  match,
  heroStats,
  idToName,
  itemConst,
  abilities,
  abilityIds,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  abilities: Abilities
  abilityIds: AbilityIds
}) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [timeSec, setTimeSec] = useState<number>(match.duration)
  const sidebarW = useSidebarWidth()
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('networth', 'desc')

  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const { radiant, dire } = useMemo(() => orderedTeams(match), [match])
  // Sorted independently per team, side never mixes: clicking a header
  // re-orders each team's own 5 rows, it doesn't merge into one 10-row list.
  const timedFor = useCallback(
    (p: MatchPlayer) => statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration),
    [match, heroMap, timeSec],
  )
  const sortedRadiant = useMemo(
    () => applySort(radiant, sortDir, (a, b) => sortValue(a, sortKey, timedFor(a), match, timeSec) - sortValue(b, sortKey, timedFor(b), match, timeSec)),
    [radiant, sortKey, sortDir, timedFor, match, timeSec],
  )
  const sortedDire = useMemo(
    () => applySort(dire, sortDir, (a, b) => sortValue(a, sortKey, timedFor(a), match, timeSec) - sortValue(b, sortKey, timedFor(b), match, timeSec)),
    [dire, sortKey, sortDir, timedFor, match, timeSec],
  )
  const scrubbable = hasTimeline(match)
  // Shrink rows so scoreboard + timeline fit the viewport without scrolling.
  const { ref: fitRef, rowH, headerH } = useRosterMetrics(scrubbable ? 82 : 36)

  const handleSelect = useCallback((slot: number) => {
    setSelectedSlot((prev) => (prev === slot ? null : slot))
  }, [])

  const cols: Col[] = useMemo(
    () => [
      { label: 'K', width: 44, sortKey: 'kills', render: (_p, t) => num('#ffffff', 18, 700)(t.kills) },
      { label: 'D', width: 44, sortKey: 'deaths', render: (_p, t) => num('#cfd4d8')(t.deaths) },
      { label: 'A', width: 44, sortKey: 'assists', render: (_p, t) => num('#cfd4d8')(t.assists) },
      {
        label: 'NET',
        width: 84,
        sortKey: 'networth',
        render: (_p, t) => num('#f2c94c', 16)(t.netWorth.toLocaleString()),
      },
      {
        label: 'Items',
        width: 6 * 36 + 5 * 3,
        render: (p) => <ItemsCell player={p} idToName={idToName} itemConst={itemConst} timeSec={timeSec} duration={match.duration} />,
      },
      {
        label: 'LH / DN',
        width: 80,
        sortKey: 'lh',
        render: (_p, t) => (
          <span className="text-[15px] tabular-nums" style={{ color: '#e8ecef', fontFamily: 'var(--font-dota)' }}>
            {t.lastHits}<span style={{ color: '#5a6066' }}> / </span>{t.denies}
          </span>
        ),
      },
      { label: 'GPM', width: 58, sortKey: 'gpm', render: (_p, t) => num('#f2c94c')(t.gpm) },
      { label: 'XPM', width: 58, sortKey: 'xpm', render: (_p, t) => num('#e8ecef')(t.xpm) },
      {
        label: 'DMG',
        width: 72,
        sortKey: 'dmg',
        render: (p) =>
          num('#e8ecef')(p.hero_damage != null ? fmtK(damageHealAtTime(match, p, timeSec).damage) : '—'),
      },
      {
        label: 'HEAL',
        width: 62,
        sortKey: 'heal',
        render: (p) =>
          num('#e8ecef')(p.hero_healing != null ? fmtK(damageHealAtTime(match, p, timeSec).healing) : '—'),
      },
      {
        label: 'BLD',
        width: 62,
        sortKey: 'bld',
        render: (p) => num('#c9a94a')(p.tower_damage != null ? fmtK(p.tower_damage) : '-'),
      },
      {
        label: 'WARDS',
        width: 66,
        sortKey: 'wards',
        render: (p) => {
          // Ward placements are timestamped, so this column follows the slider.
          const obs = p.obs_log ? p.obs_log.filter((w) => w.time <= timeSec).length : p.obs_placed
          const sen = p.sen_log ? p.sen_log.filter((w) => w.time <= timeSec).length : p.sen_placed
          return num('#e8ecef')(obs || sen ? `${obs ?? 0}/${sen ?? 0}` : '-')
        },
      },
    ],
    [idToName, itemConst, timeSec, match],
  )

  // Time-aware sidebar data: levels and team scores at the scrub position.
  const levelBySlot = new Map(
    match.players.map((p) => [
      p.player_slot,
      statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration).level,
    ]),
  )
  const radScore = teamScoreAtTime(match, true, timeSec)
  const direScore = teamScoreAtTime(match, false, timeSec)

  const hasPurchases = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  const hasBuffs = match.players.some(
    (p) => hasScepterBuff(p, idToName) || hasShardBuff(p, idToName) || hasMoonshardBuff(p),
  )
  const maxAbilities = Math.max(0, ...match.players.map((p) => p.ability_upgrades_arr?.length ?? 0))

  const label = (content: string | JSX.Element, width?: number, extraClass = '') => (
    <div
      role="columnheader"
      className={`shrink-0 flex items-center justify-center text-[13px] uppercase ${extraClass}`}
      style={{ width, height: headerH, color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
    >
      {content}
    </div>
  )

  const sortableLabel = (c: Col, extraClass = '') => (
    <div
      role="columnheader"
      className="shrink-0 flex items-center justify-center"
      style={{ width: c.width, height: headerH }}
    >
      <SortHeader
        label={c.label}
        sortKey={c.sortKey as SortKey}
        active={sortKey === c.sortKey}
        dir={sortDir}
        onClick={onSort}
        className={`text-[13px] ${extraClass}`}
        style={{ color: sortKey === c.sortKey ? undefined : '#8a97a0', letterSpacing: '1px', fontFamily: 'var(--font-dota)', minHeight: 'unset' }}
      />
    </div>
  )

  const headerRow = () => {
    return (
      <div role="row" className="flex items-stretch" style={{ height: headerH }}>
        {cols.map((c, i) =>
          c.sortKey ? (
            <div key={i}>{sortableLabel(c, i === 4 ? 'justify-start pl-1' : '')}</div>
          ) : (
            <div key={i}>{label(c.label, c.width, i === 4 ? 'justify-start pl-1' : '')}</div>
          ),
        )}
        {hasPurchases && (
          <div role="columnheader" className="flex items-center shrink-0 pl-2" style={{ minWidth: 266 }}>
            <span className="text-[13px] uppercase flex-1" style={{ color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
              Support Items
            </span>
            <GoldPip size={13} />
            <span className="w-4" />
          </div>
        )}
        {hasBuffs && (
          <div role="columnheader" className="flex items-center shrink-0 pl-2" style={{ minWidth: 110 }}>
            <span className="text-[13px] uppercase" style={{ color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
              Buffs
            </span>
          </div>
        )}
        {maxAbilities > 0 && (
          <div role="columnheader" className="flex items-center gap-[3px] px-2 shrink-0">
            {Array.from({ length: maxAbilities }, (_, i) => (
              <span
                key={i}
                className="inline-block text-center tabular-nums text-[13px]"
                style={{ width: 29, color: '#8a97a0', fontFamily: 'var(--font-dota)' }}
              >
                {i + 1}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={fitRef}>
      <div className="flex items-start" style={{ background: 'rgba(12,15,17,0.55)' }}>
        <MatchRosterSidebar
          match={match}
          heroStats={heroStats}
          width={sidebarW}
          selectedSlot={selectedSlot}
          rowH={rowH}
          headerH={headerH}
          scoreRadiant={radScore}
          scoreDire={direScore}
          levels={levelBySlot}
          radiantOrder={sortedRadiant}
          direOrder={sortedDire}
        />
        {/* Stats pane — scrolls horizontally, rows aligned with the sidebar */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="inline-block min-w-full" role="table">
            {headerRow()}
            {sortedRadiant.map((p) => (
              <PlayerRow
                key={p.player_slot}
                player={p}
                active={selectedSlot === p.player_slot}
                onSelect={handleSelect}
                cols={cols}
                heroMap={heroMap}
                allPlayers={match.players}
                timeSec={timeSec}
                duration={match.duration}
                hasPurchases={hasPurchases}
                hasBuffs={hasBuffs}
                maxAbilities={maxAbilities}
                idToName={idToName}
                itemConst={itemConst}
                abilities={abilities}
                abilityIds={abilityIds}
                rowH={rowH}
              />
            ))}
            {headerRow()}
            {sortedDire.map((p) => (
              <PlayerRow
                key={p.player_slot}
                player={p}
                active={selectedSlot === p.player_slot}
                onSelect={handleSelect}
                cols={cols}
                heroMap={heroMap}
                allPlayers={match.players}
                timeSec={timeSec}
                duration={match.duration}
                hasPurchases={hasPurchases}
                hasBuffs={hasBuffs}
                maxAbilities={maxAbilities}
                idToName={idToName}
                itemConst={itemConst}
                abilities={abilities}
                abilityIds={abilityIds}
                rowH={rowH}
              />
            ))}
          </div>
        </div>
      </div>
      {scrubbable && (
        <div className="pt-3">
          <GameTimeSlider timeSec={timeSec} duration={match.duration} onChange={setTimeSec} />
        </div>
      )}
    </div>
  )
}
