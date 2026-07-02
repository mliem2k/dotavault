import { type JSX, useRef, useState } from 'react'
import type { HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import {
  MatchRosterSidebar,
  PLAYER_COLORS,
  ROW_H,
  TEAM_HEADER_H,
  levelFromXp,
  orderedTeams,
} from './match_roster'

const SIDEBAR_W = 232
const TEAM_GAP = 8
// Total height of the roster (radiant header + 5 rows + gap + dire header + 5 rows)
const ROSTER_H = 2 * TEAM_HEADER_H + 10 * ROW_H + TEAM_GAP

type Mode = 'team' | 'networth' | 'level' | 'items'

const MODE_LABELS: Record<Mode, string> = {
  team: 'Team XP and Net Worth',
  networth: 'Player Net Worth',
  level: 'Player Level',
  items: 'Player Items',
}

const CONSUMABLES = new Set([
  'ward_observer', 'ward_sentry', 'ward_dispenser', 'tango', 'tango_single', 'flask',
  'clarity', 'enchanted_mango', 'faerie_fire', 'tpscroll', 'dust', 'smoke_of_deceit',
  'branches', 'blood_grenade', 'seer_stone',
])

function fmtGold(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
}

/* ------------------------------------------------------------------ */
/* SVG line chart (team advantage / net worth / level)                 */
/* ------------------------------------------------------------------ */

const VB_W = 1000

function toPath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
}

function GridAndAxis({
  minutes,
  vbH,
  yTicks,
}: {
  minutes: number
  vbH: number
  yTicks?: { y: number; label: string }[]
}) {
  const lines: JSX.Element[] = []
  for (let mm = 10; mm < minutes; mm += 10) {
    const x = (mm / minutes) * VB_W
    lines.push(
      <line key={`g${mm}`} x1={x} y1={0} x2={x} y2={vbH} stroke="#241f16" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
    )
  }
  return (
    <>
      {lines}
      {yTicks?.map((t, i) => (
        <line key={`y${i}`} x1={0} y1={t.y} x2={VB_W} y2={t.y} stroke="#1c1810" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  )
}

function TimeLabels({ minutes }: { minutes: number }) {
  const labels: JSX.Element[] = []
  for (let mm = 10; mm < minutes; mm += 10) {
    labels.push(
      <div
        key={mm}
        className="absolute text-[11px] tabular-nums"
        style={{ left: `${(mm / minutes) * 100}%`, top: 0, color: '#77715f', fontFamily: 'var(--font-dota)', transform: 'translateX(-50%)' }}
      >
        {mm}:00
      </div>,
    )
  }
  return <div className="relative h-4 mt-1">{labels}</div>
}

function TeamAdvantageChart({ match }: { match: Match }) {
  const gold = match.radiant_gold_adv ?? []
  const xp = match.radiant_xp_adv ?? []
  const n = Math.max(gold.length, xp.length)
  if (n < 2) return <Empty />
  const vbH = ROSTER_H
  const mid = vbH / 2
  const maxAbs = Math.max(1, ...gold.map(Math.abs), ...xp.map(Math.abs))
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (v: number) => mid - (v / maxAbs) * (mid - 8)

  const goldPts: [number, number][] = gold.map((v, i) => [xAt(i), yAt(v)])
  const xpPts: [number, number][] = xp.map((v, i) => [xAt(i), yAt(v)])

  // Area fill for gold advantage (green above midline, red below)
  const goldArea = `${toPath(goldPts)} L${xAt(n - 1)} ${mid} L0 ${mid} Z`

  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHoverIdx(Math.round(f * (n - 1)))
  }
  const hoverPct = hoverIdx != null ? (hoverIdx / (n - 1)) * 100 : 0
  const gv = hoverIdx != null ? (gold[hoverIdx] ?? 0) : 0
  const xv = hoverIdx != null ? (xp[hoverIdx] ?? 0) : 0
  const advLabel = (v: number) => `${v >= 0 ? 'Radiant' : 'Dire'} +${Math.abs(v).toLocaleString()}`

  return (
    <div className="flex-1 min-w-0">
      <div ref={wrapRef} className="relative" style={{ height: vbH }} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="none" className="w-full" style={{ height: vbH }}>
          <defs>
            <linearGradient id="advGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8ec63f" stopOpacity="0.35" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#8ec63f" stopOpacity="0.05" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#d14a38" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#d14a38" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <GridAndAxis minutes={n} vbH={vbH} />
          <line x1={0} y1={mid} x2={VB_W} y2={mid} stroke="#3a352a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <path d={goldArea} fill="url(#advGreen)" />
          <path d={toPath(goldPts)} fill="none" stroke="#c9a94a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={toPath(xpPts)} fill="none" stroke="#5a8fc2" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
          {hoverIdx != null && (
            <>
              <circle cx={xAt(hoverIdx)} cy={yAt(gv)} r={3} fill="#c9a94a" vectorEffect="non-scaling-stroke" />
              <circle cx={xAt(hoverIdx)} cy={yAt(xv)} r={3} fill="#5a8fc2" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {hoverIdx != null && (
          <>
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${hoverPct}%`, width: 1, background: '#5a544688' }} />
            <div
              className="absolute pointer-events-none rounded"
              style={{
                left: hoverPct > 55 ? undefined : `calc(${hoverPct}% + 10px)`,
                right: hoverPct > 55 ? `calc(${100 - hoverPct}% + 10px)` : undefined,
                top: 6,
                background: '#0b0a08',
                border: '1px solid #3a352a',
                padding: '6px 8px',
                fontFamily: 'var(--font-dota)',
                zIndex: 5,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-1 tabular-nums" style={{ color: '#77715f' }}>{hoverIdx}:00</div>
              <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                <span className="rounded-sm" style={{ width: 8, height: 8, background: '#c9a94a' }} />
                <span style={{ color: '#b8b2a4' }}>Net Worth</span>
                <span className="ml-auto tabular-nums font-semibold" style={{ color: gv >= 0 ? '#8ec63f' : '#d14a38' }}>{advLabel(gv)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] leading-tight mt-0.5">
                <span className="rounded-sm" style={{ width: 8, height: 8, background: '#5a8fc2' }} />
                <span style={{ color: '#b8b2a4' }}>XP</span>
                <span className="ml-auto tabular-nums font-semibold" style={{ color: xv >= 0 ? '#8ec63f' : '#d14a38' }}>{advLabel(xv)}</span>
              </div>
            </div>
          </>
        )}
      </div>
      <TimeLabels minutes={n} />
      <div className="flex items-center gap-4 mt-1 text-[11px]" style={{ fontFamily: 'var(--font-dota)' }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[2px]" style={{ background: '#c9a94a' }} /><span style={{ color: '#8a8474' }}>Net Worth adv.</span></span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-[2px]" style={{ background: '#5a8fc2' }} /><span style={{ color: '#8a8474' }}>XP adv.</span></span>
        <span className="ml-auto" style={{ color: '#5a5446' }}>Positive = Radiant ahead</span>
      </div>
    </div>
  )
}

function PlayerLinesChart({
  match,
  heroStats,
  metric,
  visibleSlots,
}: {
  match: Match
  heroStats: HeroStat[]
  metric: 'networth' | 'level'
  visibleSlots: Set<number>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const players = match.players
  const series = players.map((p) => {
    const raw = metric === 'networth' ? (p.gold_t ?? []) : (p.xp_t ?? [])
    const data = metric === 'networth' ? raw : raw.map(levelFromXp)
    return { player: p, data }
  })
  const n = Math.max(0, ...series.map((s) => s.data.length))
  if (n < 2) return <Empty />

  // Only draw selected players; rescale the y-axis to what's shown so a single
  // focused player fills the chart.
  const shown = series.filter((s) => visibleSlots.has(s.player.player_slot))
  const active = shown.length > 0 ? shown : series

  const vbH = ROSTER_H
  const pad = 10
  const maxVal = metric === 'level' ? 30 : Math.max(1, ...active.flatMap((s) => s.data))
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (v: number) => vbH - pad - (v / maxVal) * (vbH - 2 * pad)

  const yTicks =
    metric === 'level'
      ? [5, 10, 15, 20, 25, 30].map((lv) => ({ y: yAt(lv), label: String(lv) }))
      : [0.25, 0.5, 0.75, 1].map((f) => ({ y: yAt(maxVal * f), label: fmtGold(Math.round(maxVal * f)) }))

  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHoverIdx(Math.round(f * (n - 1)))
  }
  const hoverPct = hoverIdx != null ? (hoverIdx / (n - 1)) * 100 : 0
  const hoverRows =
    hoverIdx != null
      ? shown
          .map((s) => {
            const hero = heroMap.get(s.player.hero_id)
            return {
              color: PLAYER_COLORS[s.player.player_slot] ?? '#888',
              hero,
              name: hero?.localized_name ?? s.player.personaname ?? s.player.name ?? 'Anon',
              v: s.data[Math.min(hoverIdx, s.data.length - 1)] ?? 0,
            }
          })
          .sort((a, b) => b.v - a.v)
      : []

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={wrapRef}
        className="relative"
        style={{ height: vbH }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="none" className="w-full" style={{ height: vbH }}>
          <GridAndAxis minutes={n} vbH={vbH} yTicks={yTicks} />
          {shown.map((s) => {
            const color = PLAYER_COLORS[s.player.player_slot] ?? '#888'
            const pts: [number, number][] = s.data.map((v, i) => [xAt(i), yAt(v)])
            return (
              <path
                key={s.player.player_slot}
                d={toPath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={shown.length === 1 ? 2.5 : 1.75}
                strokeOpacity={0.9}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {hoverIdx != null &&
            shown.map((s) => {
              const color = PLAYER_COLORS[s.player.player_slot] ?? '#888'
              const v = s.data[Math.min(hoverIdx, s.data.length - 1)] ?? 0
              return <circle key={s.player.player_slot} cx={xAt(hoverIdx)} cy={yAt(v)} r={3} fill={color} vectorEffect="non-scaling-stroke" />
            })}
        </svg>

        {hoverIdx != null && (
          <>
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${hoverPct}%`, width: 1, background: '#5a544688' }} />
            <div
              className="absolute pointer-events-none rounded"
              style={{
                left: hoverPct > 55 ? undefined : `calc(${hoverPct}% + 10px)`,
                right: hoverPct > 55 ? `calc(${100 - hoverPct}% + 10px)` : undefined,
                top: 6,
                background: '#0b0a08',
                border: '1px solid #3a352a',
                padding: '6px 8px',
                minWidth: 130,
                fontFamily: 'var(--font-dota)',
                zIndex: 5,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-1 tabular-nums" style={{ color: '#77715f' }}>
                {hoverIdx}:00
              </div>
              {hoverRows.map((r) => (
                <div key={r.name} className="flex items-center gap-1.5 text-[11px] leading-tight py-0.5">
                  <span className="shrink-0 rounded-sm" style={{ width: 3, height: 16, background: r.color }} />
                  {r.hero && (
                    <img
                      src={heroIconUrl(r.hero.name)}
                      alt=""
                      className="shrink-0 rounded-sm"
                      style={{ width: 18, height: 18 }}
                      onError={(e) => {
                        const img = e.currentTarget
                        img.onerror = null
                        img.src = heroIconFromPath(r.hero!.icon)
                      }}
                    />
                  )}
                  <span className="flex-1 min-w-0 truncate" style={{ color: '#b8b2a4' }}>{r.name}</span>
                  <span className="tabular-nums font-semibold ml-2" style={{ color: '#dcd6c8' }}>
                    {metric === 'networth' ? r.v.toLocaleString() : r.v}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <TimeLabels minutes={n} />
    </div>
  )
}

function PlayerItemsTimeline({
  match,
  itemConst,
}: {
  match: Match
  itemConst: Record<string, ItemConst>
}) {
  const { radiant, dire } = orderedTeams(match)
  const durationSec = Math.max(1, match.duration)

  // Compute each player's row y-center to align with the sidebar.
  const rowY = (isRadiant: boolean, idx: number) => {
    const base = isRadiant ? 0 : TEAM_HEADER_H + 5 * ROW_H + TEAM_GAP
    return base + TEAM_HEADER_H + idx * ROW_H + ROW_H / 2
  }

  const renderRow = (p: MatchPlayer, isRadiant: boolean, idx: number) => {
    const color = PLAYER_COLORS[p.player_slot] ?? '#888'
    const y = rowY(isRadiant, idx)
    const purchases = (p.purchase_log ?? []).filter((e) => !CONSUMABLES.has(e.key))
    return (
      <div key={p.player_slot}>
        {/* baseline */}
        <div
          className="absolute"
          style={{ top: y, left: 0, right: 0, height: 2, background: color, opacity: 0.35, transform: 'translateY(-50%)' }}
        />
        {purchases.map((e, i) => {
          const leftPct = Math.max(0, Math.min(100, (e.time / durationSec) * 100))
          return (
            <div
              key={i}
              className="absolute"
              style={{ top: y, left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
            >
              <ItemIcon
                name={e.key}
                meta={itemConst[e.key]}
                width={24}
                height={18}
                style={{ border: `1px solid ${color}` }}
              />
            </div>
          )
        })}
      </div>
    )
  }

  // vertical gridlines
  const minutes = Math.ceil(durationSec / 60)
  const grid: JSX.Element[] = []
  for (let mm = 10; mm < minutes; mm += 10) {
    grid.push(
      <div key={mm} className="absolute top-0 bottom-0" style={{ left: `${((mm * 60) / durationSec) * 100}%`, width: 1, background: '#241f16' }}>
        <span className="absolute text-[11px] tabular-nums" style={{ top: '50%', left: 4, color: '#77715f', fontFamily: 'var(--font-dota)' }}>{mm}:00</span>
      </div>,
    )
  }

  const hasAny = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  if (!hasAny) return <Empty />

  return (
    <div className="flex-1 min-w-0 relative" style={{ height: ROSTER_H }}>
      {grid}
      {radiant.map((p, i) => renderRow(p, true, i))}
      {dire.map((p, i) => renderRow(p, false, i))}
    </div>
  )
}

function Empty() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ height: ROSTER_H }}>
      <span className="text-sm" style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}>
        This match is unparsed — timeline data unavailable.
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export function MatchGraphs({
  match,
  heroStats,
  itemConst,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
}) {
  const hasAdv = (match.radiant_gold_adv?.length ?? 0) > 1
  const hasNet = match.players.some((p) => (p.gold_t?.length ?? 0) > 1)
  const hasXp = match.players.some((p) => (p.xp_t?.length ?? 0) > 1)
  const hasItems = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)

  const available: Mode[] = [
    ...(hasAdv ? (['team'] as Mode[]) : []),
    ...(hasNet ? (['networth'] as Mode[]) : []),
    ...(hasXp ? (['level'] as Mode[]) : []),
    ...(hasItems ? (['items'] as Mode[]) : []),
  ]

  const [mode, setMode] = useState<Mode>('items')
  const activeMode = available.includes(mode) ? mode : (available[0] ?? 'items')

  // Which players' lines are shown (Player Net Worth / Player Level modes).
  const [visibleSlots, setVisibleSlots] = useState<Set<number>>(
    () => new Set(match.players.map((p) => p.player_slot)),
  )
  function toggleSlot(slot: number) {
    setVisibleSlots((prev) => {
      const next = new Set(prev)
      if (next.has(slot)) {
        if (next.size > 1) next.delete(slot) // keep at least one line
      } else {
        next.add(slot)
      }
      return next
    })
  }
  const perPlayerMode = activeMode === 'networth' || activeMode === 'level'

  // Position presets derived from lane role + farm priority, index 0..4 = pos 1..5.
  const { radiant: radTeam, dire: direTeam } = orderedTeams(match)
  const derivePositions = (team: MatchPlayer[]): (MatchPlayer | undefined)[] => {
    const used = new Set<number>()
    const pick = (role: number) => {
      const c = team
        .filter((p) => !used.has(p.player_slot) && p.lane_role === role)
        .sort((a, b) => b.net_worth - a.net_worth)[0]
      if (c) used.add(c.player_slot)
      return c
    }
    const pos1 = pick(1) // safelane core
    const pos2 = pick(2) // mid
    const pos3 = pick(3) // offlane core
    const pos5 = pick(1) // remaining safelane → hard support
    const pos4 = pick(3) // remaining offlane → soft support
    const out: (MatchPlayer | undefined)[] = [pos1, pos2, pos3, pos4, pos5]
    // Fill any gaps (missing lane data) with leftover players by net worth.
    const leftover = team.filter((p) => !used.has(p.player_slot)).sort((a, b) => b.net_worth - a.net_worth)
    for (let i = 0; i < 5; i++) if (!out[i]) out[i] = leftover.shift()
    return out
  }
  const radPos = derivePositions(radTeam)
  const direPos = derivePositions(direTeam)
  const POSITIONS = ['Safelane', 'Midlane', 'Offlane', 'Soft Support', 'Hard Support']
  const positionSlots = (i: number) => {
    const slots = new Set<number>()
    if (radPos[i]) slots.add(radPos[i]!.player_slot)
    if (direPos[i]) slots.add(direPos[i]!.player_slot)
    return slots
  }
  const selectPosition = (i: number) => {
    const slots = positionSlots(i)
    if (slots.size) setVisibleSlots(slots)
  }
  const allSlots = () => setVisibleSlots(new Set(match.players.map((p) => p.player_slot)))

  if (available.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm" style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}>
          This match is unparsed — request a parse to see graphs.
        </span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 980 }}>
        {/* Mode toggle (full width) */}
        <div className="flex gap-1 mb-2" style={{ marginLeft: SIDEBAR_W + 16 }}>
          {available.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors rounded-sm"
              style={{
                fontFamily: 'var(--font-dota)',
                color: activeMode === m ? '#ece6d8' : '#8a8474',
                background: activeMode === m ? '#2a2620' : '#16130f',
                border: `1px solid ${activeMode === m ? '#3a352a' : '#241f16'}`,
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {perPlayerMode && (
          <div
            className="flex items-center gap-1.5 mb-2 flex-wrap"
            style={{ fontFamily: 'var(--font-dota)', marginLeft: SIDEBAR_W + 16 }}
          >
            <span className="text-[11px] mr-1" style={{ color: '#5a5446' }}>
              Showing {visibleSlots.size}/{match.players.length}:
            </span>
            <button
              type="button"
              onClick={allSlots}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm"
              style={{
                color: visibleSlots.size === match.players.length ? '#ece6d8' : '#8a8474',
                background: visibleSlots.size === match.players.length ? '#2a2620' : '#16130f',
                border: '1px solid #241f16',
              }}
            >
              All
            </button>
            {POSITIONS.map((label, i) => {
              const slots = positionSlots(i)
              const isActive =
                slots.size > 0 &&
                visibleSlots.size === slots.size &&
                [...slots].every((s) => visibleSlots.has(s))
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectPosition(i)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm"
                  style={{
                    color: isActive ? '#ece6d8' : '#8a8474',
                    background: isActive ? '#2a2620' : '#16130f',
                    border: '1px solid #241f16',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-4">
          {/* Roster sidebar — interactive legend in per-player modes */}
          <MatchRosterSidebar
            match={match}
            heroStats={heroStats}
            width={SIDEBAR_W}
            interactive={perPlayerMode}
            visibleSlots={perPlayerMode ? visibleSlots : undefined}
            onToggle={toggleSlot}
            showColors={perPlayerMode}
          />

          {/* Chart column */}
          <div className="flex-1 min-w-0">
            {activeMode === 'team' && <TeamAdvantageChart match={match} />}
            {activeMode === 'networth' && <PlayerLinesChart match={match} heroStats={heroStats} metric="networth" visibleSlots={visibleSlots} />}
            {activeMode === 'level' && <PlayerLinesChart match={match} heroStats={heroStats} metric="level" visibleSlots={visibleSlots} />}
            {activeMode === 'items' && <PlayerItemsTimeline match={match} itemConst={itemConst} />}
          </div>
        </div>
      </div>
    </div>
  )
}
