import { type JSX, useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { AbilityIcon } from './ability_icon'
import { ItemIcon } from './item_icon'
import { MatchRosterSidebar, orderedTeams, useRosterMetrics } from './match_roster'
import { GameTimeSlider, damageHealAtTime, hasTimeline, itemsAtTime, statsAtTime, teamScoreAtTime, type TimedStats } from './match_time'

const SIDEBAR_W = 272

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

/* Enemy heroes this player killed, aligned to the fixed enemy roster order. */
function HeroKillsGroup({
  player,
  enemies,
  timeSec,
  duration,
  totalKills,
}: {
  player: MatchPlayer
  enemies: HeroStat[]
  timeSec: number
  duration: number
  totalKills: number
}) {
  const atEnd = timeSec >= duration
  const killCount = (heroName: string) =>
    (player.kills_log ?? []).filter((e) => e.key === heroName && (atEnd || e.time <= timeSec)).length

  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0">
      {enemies.map((h) => {
        const n = killCount(h.name)
        return (
          <a
            key={h.id}
            href={`/hero/${heroSlug(h.localized_name)}`}
            className="relative shrink-0 block"
            style={{ opacity: n > 0 ? 1 : 0.25 }}
          >
            <img
              src={heroIconUrl(h.name)}
              alt={h.localized_name}
              title={`${h.localized_name}: ${n}`}
              style={{ width: 32, height: 32, filter: n > 0 ? 'none' : 'grayscale(1)' }}
              onError={(e) => {
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(h.icon)
              }}
            />
            {n > 0 && (
              <span
                className="absolute -bottom-1 -right-1 text-[10px] px-0.5 tabular-nums"
                style={{ background: '#0a0c0e', color: '#e8ecef', fontFamily: 'var(--font-dota)' }}
              >
                x{n}
              </span>
            )}
          </a>
        )
      })}
      <div
        className="flex items-center justify-center ml-2 shrink-0 text-[18px] tabular-nums"
        style={{ width: 44, height: 40, background: 'rgba(216,222,227,0.08)', color: '#ffffff', fontFamily: 'var(--font-dota)' }}
      >
        {totalKills}
      </div>
    </div>
  )
}

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
  label: string | JSX.Element
  width: number
  align?: 'center' | 'right'
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

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)
  const scrubbable = hasTimeline(match)
  // Shrink rows so scoreboard + timeline fit the viewport without scrolling.
  const { ref: fitRef, rowH, headerH } = useRosterMetrics(scrubbable ? 82 : 36)

  const num = (color: string, size = 16, weight = 400) => (v: number | string) => (
    <span className="tabular-nums" style={{ color, fontSize: size, fontWeight: weight, fontFamily: 'var(--font-dota)' }}>{v}</span>
  )

  const cols: Col[] = [
    { label: 'K', width: 44, render: (_p, t) => num('#ffffff', 18, 700)(t.kills) },
    { label: 'D', width: 44, render: (_p, t) => num('#cfd4d8')(t.deaths) },
    { label: 'A', width: 44, render: (_p, t) => num('#cfd4d8')(t.assists) },
    {
      label: (<span className="inline-flex items-center gap-1"><GoldPip />NET</span>),
      width: 84,
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
      render: (_p, t) => (
        <span className="text-[15px] tabular-nums" style={{ color: '#e8ecef', fontFamily: 'var(--font-dota)' }}>
          {t.lastHits}<span style={{ color: '#5a6066' }}> / </span>{t.denies}
        </span>
      ),
    },
    { label: 'GPM', width: 58, render: (_p, t) => num('#f2c94c')(t.gpm) },
    { label: 'XPM', width: 58, render: (_p, t) => num('#e8ecef')(t.xpm) },
    {
      label: 'DMG',
      width: 72,
      render: (p) =>
        num('#e8ecef')(p.hero_damage != null ? fmtK(damageHealAtTime(match, p, timeSec).damage) : '—'),
    },
    {
      label: 'HEAL',
      width: 62,
      render: (p) =>
        num('#e8ecef')(p.hero_healing != null ? fmtK(damageHealAtTime(match, p, timeSec).healing) : '—'),
    },
    {
      label: 'BLD',
      width: 62,
      render: (p) => num('#c9a94a')(p.tower_damage != null ? fmtK(p.tower_damage) : '-'),
    },
    {
      label: 'WARDS',
      width: 66,
      render: (p) => {
        // Ward placements are timestamped, so this column follows the slider.
        const obs = p.obs_log ? p.obs_log.filter((w) => w.time <= timeSec).length : p.obs_placed
        const sen = p.sen_log ? p.sen_log.filter((w) => w.time <= timeSec).length : p.sen_placed
        return num('#e8ecef')(obs || sen ? `${obs ?? 0}/${sen ?? 0}` : '-')
      },
    },
    { label: 'MMR', width: 84, render: () => num('#67757f')('—') },
  ]

  // Time-aware sidebar data: levels and team scores at the scrub position.
  const levelBySlot = new Map(
    match.players.map((p) => [
      p.player_slot,
      statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration).level,
    ]),
  )
  const radScore = teamScoreAtTime(match, true, timeSec)
  const direScore = teamScoreAtTime(match, false, timeSec)

  const hasKillLogs = match.players.some((p) => (p.kills_log?.length ?? 0) > 0)
  const hasPurchases = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  const maxAbilities = Math.max(0, ...match.players.map((p) => p.ability_upgrades_arr?.length ?? 0))

  const label = (content: string | JSX.Element, width?: number, extraClass = '') => (
    <div
      className={`shrink-0 flex items-center justify-center text-[13px] uppercase ${extraClass}`}
      style={{ width, height: headerH, color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
    >
      {content}
    </div>
  )

  const headerRow = (isRadiant: boolean) => {
    const enemies = isRadiant ? dire : radiant
    return (
      <div className="flex items-stretch" style={{ height: headerH }}>
        {cols.map((c, i) => label(c.label as string | JSX.Element, c.width, i === 4 ? 'justify-start pl-1' : ''))}
        {hasKillLogs && (
          <div className="flex items-center shrink-0 pl-2" style={{ width: enemies.length * 38 + 60 }}>
            <span className="text-[13px] uppercase flex-1" style={{ color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
              {isRadiant ? 'Dire' : 'Radiant'} Heroes Killed
            </span>
            <span className="text-[13px] uppercase pr-3" style={{ color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
              Total
            </span>
          </div>
        )}
        {hasPurchases && (
          <div className="flex items-center shrink-0 pl-2" style={{ minWidth: 266 }}>
            <span className="text-[13px] uppercase flex-1" style={{ color: '#8a97a0', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
              Support Items
            </span>
            <GoldPip size={13} />
            <span className="w-4" />
          </div>
        )}
        {maxAbilities > 0 && (
          <div className="flex items-center gap-[3px] px-2 shrink-0">
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

  const playerRow = (p: MatchPlayer, isRadiant: boolean) => {
    const active = selectedSlot === p.player_slot
    const enemies = isRadiant ? dire : radiant
    const enemyHeroes = enemies.map((e) => heroMap.get(e.hero_id)).filter((h): h is HeroStat => !!h)
    const timed = statsAtTime(p, match.players, heroMap.get(p.hero_id)?.name ?? '', timeSec, match.duration)
    return (
      <button
        key={p.player_slot}
        type="button"
        onClick={() => setSelectedSlot(active ? null : p.player_slot)}
        className="flex items-stretch w-full text-left cursor-pointer hover:bg-white/[0.04]"
        style={{ height: rowH, background: active ? 'rgba(255,255,255,0.13)' : undefined, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            className={`shrink-0 flex items-center ${i === 4 ? 'justify-start pl-1' : 'justify-center'}`}
            style={{ width: c.width }}
          >
            {c.render(p, timed)}
          </div>
        ))}
        {hasKillLogs && (
          <div className="flex items-center shrink-0">
            <HeroKillsGroup
              player={p}
              enemies={enemyHeroes}
              timeSec={timeSec}
              duration={match.duration}
              totalKills={timed.kills}
            />
          </div>
        )}
        {hasPurchases && (
          <div className="flex items-center shrink-0">
            <SupportItemsGroup player={p} itemConst={itemConst} timeSec={timeSec} duration={match.duration} />
          </div>
        )}
        {maxAbilities > 0 && (
          <div className="flex items-center shrink-0">
            <AbilityBuildGroup player={p} abilities={abilities} abilityIds={abilityIds} maxLevel={timed.level} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div ref={fitRef}>
      <div className="flex items-start" style={{ background: 'rgba(12,15,17,0.55)' }}>
        <MatchRosterSidebar
          match={match}
          heroStats={heroStats}
          width={SIDEBAR_W}
          selectedSlot={selectedSlot}
          rowH={rowH}
          headerH={headerH}
          scoreRadiant={radScore}
          scoreDire={direScore}
          levels={levelBySlot}
        />
        {/* Stats pane — scrolls horizontally, rows aligned with the sidebar */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="inline-block min-w-full">
            {headerRow(true)}
            {radiant.map((p) => playerRow(p, true))}
            {headerRow(false)}
            {dire.map((p) => playerRow(p, false))}
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
