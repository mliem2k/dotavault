import { type JSX, useState } from 'react'
import type { HeroStat, ItemConst, Match, MatchPlayer } from 'types'
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

  return (
    <div className="flex-1 min-w-0">
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
      </svg>
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
  metric,
}: {
  match: Match
  metric: 'networth' | 'level'
}) {
  const players = match.players
  const series = players.map((p) => {
    const raw = metric === 'networth' ? (p.gold_t ?? []) : (p.xp_t ?? [])
    const data = metric === 'networth' ? raw : raw.map(levelFromXp)
    return { player: p, data }
  })
  const n = Math.max(0, ...series.map((s) => s.data.length))
  if (n < 2) return <Empty />

  const vbH = ROSTER_H
  const pad = 10
  const maxVal = metric === 'level' ? 30 : Math.max(1, ...series.flatMap((s) => s.data))
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (v: number) => vbH - pad - (v / maxVal) * (vbH - 2 * pad)

  const yTicks =
    metric === 'level'
      ? [5, 10, 15, 20, 25, 30].map((lv) => ({ y: yAt(lv), label: String(lv) }))
      : [0.25, 0.5, 0.75, 1].map((f) => ({ y: yAt(maxVal * f), label: fmtGold(Math.round(maxVal * f)) }))

  return (
    <div className="flex-1 min-w-0">
      <svg viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="none" className="w-full" style={{ height: vbH }}>
        <GridAndAxis minutes={n} vbH={vbH} yTicks={yTicks} />
        {series.map((s) => {
          const color = PLAYER_COLORS[s.player.player_slot] ?? '#888'
          const pts: [number, number][] = s.data.map((v, i) => [xAt(i), yAt(v)])
          return (
            <path
              key={s.player.player_slot}
              d={toPath(pts)}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeOpacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
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
        <div className="flex gap-4">
          {/* Roster sidebar */}
          <MatchRosterSidebar match={match} heroStats={heroStats} width={SIDEBAR_W} />

          {/* Chart column */}
          <div className="flex-1 min-w-0">
            {/* Mode toggle */}
            <div className="flex gap-1 mb-3">
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

            {activeMode === 'team' && <TeamAdvantageChart match={match} />}
            {activeMode === 'networth' && <PlayerLinesChart match={match} metric="networth" />}
            {activeMode === 'level' && <PlayerLinesChart match={match} metric="level" />}
            {activeMode === 'items' && <PlayerItemsTimeline match={match} itemConst={itemConst} />}
          </div>
        </div>
      </div>
    </div>
  )
}
