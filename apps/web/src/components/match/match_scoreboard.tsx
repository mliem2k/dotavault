import { type JSX, memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { rankBadge, rankName } from '@/lib/rank'
import { applySort, useSort } from '@/lib/sortable'
import { AbilityIcon } from './ability_icon'
import { ItemIcon } from './item_icon'
import { MatchRosterSidebar, orderedTeams, useRosterMetrics } from './match_roster'
import {
  damageHealAtTime,
  GameTimeSlider,
  hasMoonshardBuff,
  hasTimeline,
  itemsAtTime,
  scepterSource,
  shardSource,
  statsAtTime,
  type TimedStats,
  teamScoreAtTime,
} from './match_time'

type SortKey =
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'networth'
  | 'lh'
  | 'gpm'
  | 'xpm'
  | 'dmg'
  | 'heal'
  | 'bld'
  | 'wards'
  | 'rank'

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
    case 'rank':
      return p.rank_tier ?? -1
  }
}

const SIDEBAR_W = 272
const SIDEBAR_W_MOBILE = 140
const MOBILE_QUERY = '(max-width: 640px)'

/* Responsive sidebar width: the roster sidebar sits outside the stats pane's
   own horizontal scroll, so on narrow viewports it must shrink instead of
   permanently eating most of the screen. */
function useSidebarWidth(): number {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
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
  'ward_observer',
  'ward_sentry',
  'ward_dispenser',
  'dust',
  'smoke_of_deceit',
  'tpscroll',
  'flask',
  'clarity',
  'tango',
  'tango_single',
  'enchanted_mango',
  'faerie_fire',
  'gem',
  'infused_raindrop',
  'bottle',
  'blood_grenade',
  'cheese',
])

const GoldPip = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="none"
    className="inline-block shrink-0 -mt-0.5"
  >
    <title>Gold</title>
    <circle cx="5" cy="5" r="4.5" fill="#e5b12c" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#5a4106" fontWeight="bold">
      $
    </text>
  </svg>
)

function fmtK(v: number | null | undefined): string {
  const n = v ?? 0
  return n.toLocaleString()
}

const num =
  (colorClass: string, size = 16, weight = 400) =>
  (v: number | string) => (
    <span
      className={`tabular-nums font-dota ${colorClass}`}
      style={{ fontSize: size, fontWeight: weight }}
    >
      {v}
    </span>
  )

/* Support items purchased + total gold spent on them. */
// Distinct support-item icons that fit the fixed icons zone (see
// SUPPORT_ITEMS_ICONS_W below) without growing the row: 5 * 32px icons + 4 *
// 6px gaps = 184px, inside a 188px zone.
const MAX_VISIBLE_SUPPORT_ITEMS = 5
const SUPPORT_ITEMS_ICONS_W = 188

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
    if (SUPPORT_ITEMS.has(e.key) && (atEnd || e.time <= timeSec))
      counts.set(e.key, (counts.get(e.key) ?? 0) + 1)
  }
  const entries = [...counts.entries()]
  const gold = entries.reduce((s, [name, n]) => s + n * (itemConst[name]?.cost ?? 0), 0)
  const overflow = entries.length > MAX_VISIBLE_SUPPORT_ITEMS
  const visible = overflow ? entries.slice(0, MAX_VISIBLE_SUPPORT_ITEMS - 1) : entries
  const extraCount = entries.length - visible.length

  return (
    // Fixed width (not minWidth) so every row's box is exactly the same
    // size regardless of how many distinct items a player bought: a
    // minWidth-only box grows past it once content needs more room,
    // which shifts the gold total (and every column after it) out of
    // alignment row to row.
    <div className="flex items-center gap-1.5 px-2 shrink-0" style={{ width: 266 }}>
      <div
        className="flex items-center gap-1.5 shrink-0 overflow-hidden"
        style={{ width: SUPPORT_ITEMS_ICONS_W }}
      >
        {visible.map(([name, n]) => (
          <div key={name} className="relative shrink-0">
            <ItemIcon name={name} meta={itemConst[name]} width={32} height={24} />
            {n > 1 && (
              <span
                className="absolute -bottom-1 -right-1 text-[10px] px-0.5 tabular-nums text-slate-foreground-light font-dota"
                style={{ background: '#0a0c0e' }}
              >
                x{n}
              </span>
            )}
          </div>
        ))}
        {extraCount > 0 && (
          <div
            className="flex items-center justify-center shrink-0 rounded-sm text-[11px] tabular-nums text-slate-muted-light"
            style={{ width: 32, height: 24, background: '#12100c', border: '1px solid #241f16' }}
            title={`${extraCount} more support item type${extraCount > 1 ? 's' : ''}`}
          >
            +{extraCount}
          </div>
        )}
      </div>
      <span className="w-14 text-right text-[15px] tabular-nums text-gold font-dota">
        {gold > 0 ? gold.toLocaleString() : '0'}
      </span>
    </div>
  )
}

// Gold border on top of ItemIcon's own frame: same recognizable shop icon
// as the Items column (with its tooltip and CDN fallback), but visually
// flagged as a "buff" callout rather than "they currently hold this item"
// (true for the sold case, and outright wrong for Blessing, which has no
// item at all).
const BUFF_BORDER = '2px solid #d4af37'

function AghsBuffIcon({
  itemName,
  itemConst,
  label,
}: {
  itemName: string
  itemConst: Record<string, ItemConst>
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <ItemIcon
            name={itemName}
            meta={itemConst[itemName]}
            width={32}
            height={24}
            style={{ border: BUFF_BORDER }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/* Permanent buffs only, meaning facts not already visible in the Items
   column: Aghanim's Blessing (no backing item, ever), a Scepter/Shard that
   was bought then later sold (the Items column only reflects final state,
   so a sold upgrade has nowhere else to show), and Moon Shard (consumed on
   use, never sits in a slot). A Scepter/Shard still sitting in their final
   inventory (source 'held') is NOT shown here, that's already fully
   visible in the Items column, showing it again under a "Buffs" header
   would mislabel it and duplicate that column. Final state only, not
   time-scrubbed, since these are "did they ever get this" facts rather
   than a snapshot of current inventory. */
function BuffsGroup({
  player,
  idToName,
  itemConst,
}: {
  player: MatchPlayer
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
}) {
  const scepter = scepterSource(player, idToName)
  const shard = shardSource(player, idToName)
  const moonshard = hasMoonshardBuff(player)

  return (
    // Fixed width, not minWidth: there are only ever at most 3 possible
    // buffs so this never needs to grow, but width (not minWidth) keeps the
    // box the same size in a 0-buff row too, matching every other section.
    <div className="flex items-center gap-1.5 px-2 shrink-0" style={{ width: 124 }}>
      {scepter === 'sold' && (
        <AghsBuffIcon
          itemName="ultimate_scepter"
          itemConst={itemConst}
          label="Aghanim's Scepter (bought earlier, later sold; the upgrade stays active)"
        />
      )}
      {scepter === 'blessing' && (
        <AghsBuffIcon
          itemName="ultimate_scepter"
          itemConst={itemConst}
          label="Aghanim's Blessing (Scepter effect)"
        />
      )}
      {shard === 'sold' && (
        <AghsBuffIcon
          itemName="aghanims_shard"
          itemConst={itemConst}
          label="Aghanim's Shard (bought earlier, later sold; the upgrade stays active)"
        />
      )}
      {shard === 'blessing' && (
        <AghsBuffIcon
          itemName="aghanims_shard"
          itemConst={itemConst}
          label="Aghanim's Blessing (Shard effect)"
        />
      )}
      {moonshard && (
        <ItemIcon name="moon_shard" meta={itemConst.moon_shard} width={32} height={24} />
      )}
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
          <AbilityIcon
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed level-order sequence, positions never reorder
            key={i}
            name={name}
            meta={abilities[name]}
            isTalent={isTalent}
            level={i + 1}
          />
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
          <ItemIcon
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed inventory-slot position, not reorderable
            key={i}
            name={name}
            meta={name ? itemConst[name] : undefined}
            width={36}
            height={27}
          />
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
  const timed = statsAtTime(
    player,
    allPlayers,
    heroMap.get(player.hero_id)?.name ?? '',
    timeSec,
    duration,
  )

  const toggle = () => onSelect(player.player_slot)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <tr
      tabIndex={0}
      aria-selected={active}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className="flex items-stretch w-full text-left cursor-pointer hover:bg-white/[0.04]"
      style={{
        height: rowH,
        background: active ? 'rgba(255,255,255,0.13)' : undefined,
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      {cols.map((c, i) => (
        <td
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed column position, not reorderable
          key={i}
          className={`shrink-0 flex items-center ${i === 4 ? 'justify-start pl-1' : 'justify-center'}`}
          style={{ width: c.width }}
        >
          {c.render(player, timed)}
        </td>
      ))}
      {hasPurchases && (
        <td className="flex items-center shrink-0">
          <SupportItemsGroup
            player={player}
            itemConst={itemConst}
            timeSec={timeSec}
            duration={duration}
          />
        </td>
      )}
      {hasBuffs && (
        <td className="flex items-center shrink-0">
          <BuffsGroup player={player} idToName={idToName} itemConst={itemConst} />
        </td>
      )}
      {maxAbilities > 0 && (
        <td className="flex items-center shrink-0">
          <AbilityBuildGroup
            player={player}
            abilities={abilities}
            abilityIds={abilityIds}
            maxLevel={timed.level}
          />
        </td>
      )}
    </tr>
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
    (p: MatchPlayer) =>
      statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration),
    [match, heroMap, timeSec],
  )
  const sortedRadiant = useMemo(
    () =>
      applySort(
        radiant,
        sortDir,
        (a, b) =>
          sortValue(a, sortKey, timedFor(a), match, timeSec) -
          sortValue(b, sortKey, timedFor(b), match, timeSec),
      ),
    [radiant, sortKey, sortDir, timedFor, match, timeSec],
  )
  const sortedDire = useMemo(
    () =>
      applySort(
        dire,
        sortDir,
        (a, b) =>
          sortValue(a, sortKey, timedFor(a), match, timeSec) -
          sortValue(b, sortKey, timedFor(b), match, timeSec),
      ),
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
      {
        label: 'K',
        width: 44,
        sortKey: 'kills',
        render: (_p, t) => num('text-white', 18, 700)(t.kills),
      },
      {
        label: 'D',
        width: 44,
        sortKey: 'deaths',
        render: (_p, t) => num('text-slate-foreground')(t.deaths),
      },
      {
        label: 'A',
        width: 44,
        sortKey: 'assists',
        render: (_p, t) => num('text-slate-foreground')(t.assists),
      },
      {
        label: 'NET',
        width: 84,
        sortKey: 'networth',
        render: (_p, t) => num('text-gold', 16)(t.netWorth.toLocaleString()),
      },
      {
        label: 'Items',
        width: 6 * 36 + 5 * 3,
        render: (p) => (
          <ItemsCell
            player={p}
            idToName={idToName}
            itemConst={itemConst}
            timeSec={timeSec}
            duration={match.duration}
          />
        ),
      },
      {
        label: 'LH / DN',
        width: 80,
        sortKey: 'lh',
        render: (_p, t) => (
          <span className="text-[15px] tabular-nums text-slate-foreground-light font-dota">
            {t.lastHits}
            <span className="text-slate-muted"> / </span>
            {t.denies}
          </span>
        ),
      },
      { label: 'GPM', width: 58, sortKey: 'gpm', render: (_p, t) => num('text-gold')(t.gpm) },
      {
        label: 'XPM',
        width: 58,
        sortKey: 'xpm',
        render: (_p, t) => num('text-slate-foreground-light')(t.xpm),
      },
      {
        label: 'DMG',
        width: 72,
        sortKey: 'dmg',
        render: (p) =>
          num('text-slate-foreground-light')(
            p.hero_damage != null ? fmtK(damageHealAtTime(match, p, timeSec).damage) : '—',
          ),
      },
      {
        label: 'HEAL',
        width: 62,
        sortKey: 'heal',
        render: (p) =>
          num('text-slate-foreground-light')(
            p.hero_healing != null ? fmtK(damageHealAtTime(match, p, timeSec).healing) : '—',
          ),
      },
      {
        label: 'BLD',
        width: 62,
        sortKey: 'bld',
        render: (p) => num('text-gold')(p.tower_damage != null ? fmtK(p.tower_damage) : '-'),
      },
      {
        label: 'WARDS',
        width: 66,
        sortKey: 'wards',
        render: (p) => {
          // Ward placements are timestamped, so this column follows the slider.
          const obs = p.obs_log ? p.obs_log.filter((w) => w.time <= timeSec).length : p.obs_placed
          const sen = p.sen_log ? p.sen_log.filter((w) => w.time <= timeSec).length : p.sen_placed
          return num('text-slate-foreground-light')(obs || sen ? `${obs ?? 0}/${sen ?? 0}` : '-')
        },
      },
      {
        label: 'RANK',
        width: 56,
        sortKey: 'rank',
        render: (p) => {
          const badge = rankBadge(p.rank_tier)
          return (
            <span title={rankName(p.rank_tier)}>
              {badge ? (
                <img
                  src={badge.medal}
                  alt=""
                  style={{ width: 24, height: 24 }}
                  className="object-contain"
                />
              ) : (
                <span style={{ color: '#4d565c' }}>-</span>
              )}
            </span>
          )
        },
      },
    ],
    [idToName, itemConst, timeSec, match],
  )

  // Time-aware sidebar data: levels and team scores at the scrub position.
  const levelBySlot = new Map(
    match.players.map((p) => [
      p.player_slot,
      statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration)
        .level,
    ]),
  )
  const radScore = teamScoreAtTime(match, true, timeSec)
  const direScore = teamScoreAtTime(match, false, timeSec)

  const hasPurchases = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  const hasBuffs = match.players.some((p) => {
    const scepter = scepterSource(p, idToName)
    const shard = shardSource(p, idToName)
    return (
      scepter === 'sold' ||
      scepter === 'blessing' ||
      shard === 'sold' ||
      shard === 'blessing' ||
      hasMoonshardBuff(p)
    )
  })
  const maxAbilities = Math.max(0, ...match.players.map((p) => p.ability_upgrades_arr?.length ?? 0))

  const label = (key: number, content: string | JSX.Element, width?: number, extraClass = '') => (
    <th
      key={key}
      scope="col"
      className={`shrink-0 flex items-center justify-center text-[13px] uppercase text-slate-muted-light font-dota ${extraClass}`}
      style={{ width, height: headerH, letterSpacing: '1px' }}
    >
      {content}
    </th>
  )

  const sortableLabel = (key: number, c: Col, extraClass = '') => (
    <th
      key={key}
      scope="col"
      className="shrink-0 flex items-center justify-center"
      style={{ width: c.width, height: headerH }}
    >
      <SortHeader
        label={c.label}
        sortKey={c.sortKey as SortKey}
        active={sortKey === c.sortKey}
        dir={sortDir}
        onClick={onSort}
        className={`text-[13px] font-dota ${sortKey === c.sortKey ? '' : 'text-slate-muted-light'} ${extraClass}`}
        style={{ letterSpacing: '1px', minHeight: 'unset' }}
      />
    </th>
  )

  const headerRow = () => {
    return (
      <tr className="flex items-stretch" style={{ height: headerH }}>
        {cols.map((c, i) =>
          c.sortKey
            ? sortableLabel(i, c, i === 4 ? 'justify-start pl-1' : '')
            : label(i, c.label, c.width, i === 4 ? 'justify-start pl-1' : ''),
        )}
        {hasPurchases && (
          <th scope="col" className="flex items-center shrink-0 pl-2" style={{ width: 266 }}>
            <span
              className="text-[13px] uppercase flex-1 text-slate-muted-light font-dota"
              style={{ letterSpacing: '1px' }}
            >
              Support Items
            </span>
            <GoldPip size={13} />
            <span className="w-4" />
          </th>
        )}
        {hasBuffs && (
          <th scope="col" className="flex items-center shrink-0 pl-2" style={{ width: 140 }}>
            <span
              className="text-[13px] uppercase text-slate-muted-light font-dota"
              style={{ letterSpacing: '1px' }}
            >
              Buffs
            </span>
          </th>
        )}
        {maxAbilities > 0 && (
          <th scope="col" className="flex items-center gap-[3px] px-2 shrink-0">
            {/* width matches AbilityIcon's default 26px size exactly (not a
                round number like 29) so each header number stays lined up
                with its own ability icon below instead of drifting right
                by 3px per slot as the sequence gets longer. */}
            {Array.from({ length: maxAbilities }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed level-order sequence, positions never reorder
                key={i}
                className="inline-block text-center tabular-nums text-[13px] text-slate-muted-light font-dota"
                style={{ width: 26 }}
              >
                {i + 1}
              </span>
            ))}
          </th>
        )}
      </tr>
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
          <table className="inline-block min-w-full">
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
          </table>
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
