import { type JSX, useRef, useState } from 'react'
import type { HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import {
  levelFromXp,
  MatchRosterSidebar,
  orderedTeams,
  PLAYER_COLORS,
  useRosterMetrics,
} from './match_roster'

const SIDEBAR_W = 252

type Mode = 'team' | 'winprob' | 'networth' | 'level' | 'lasthits' | 'items'

const MODE_LABELS: Record<Mode, string> = {
  team: 'Team XP and Net Worth',
  winprob: 'Win Probability (est.)',
  networth: 'Player Net Worth',
  level: 'Player Level',
  lasthits: 'Player Last Hits',
  items: 'Player Items',
}

const CONSUMABLES = new Set([
  'ward_observer',
  'ward_sentry',
  'ward_dispenser',
  'tango',
  'tango_single',
  'flask',
  'clarity',
  'enchanted_mango',
  'faerie_fire',
  'tpscroll',
  'dust',
  'smoke_of_deceit',
  'branches',
  'blood_grenade',
  'seer_stone',
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
      <line
        key={`g${mm}`}
        x1={x}
        y1={0}
        x2={x}
        y2={vbH}
        stroke="#2a3136"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />,
    )
  }
  return (
    <>
      {lines}
      {yTicks?.map((t, i) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: static axis tick decoration
          key={`y${i}`}
          x1={0}
          y1={t.y}
          x2={VB_W}
          y2={t.y}
          stroke="#1f2529"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
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
        className="absolute text-[11px] tabular-nums text-slate-muted font-dota"
        style={{ left: `${(mm / minutes) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
      >
        {mm}:00
      </div>,
    )
  }
  return <div className="relative h-4 mt-1">{labels}</div>
}

/* Estimated win probability from the gold and XP advantage curves via a
   logistic squash: NOT a trained model like Stratz's, just a transparent
   heuristic (10k combined advantage is about 88% favored). */
function WinProbChart({ match, vbH }: { match: Match; vbH: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const gold = match.radiant_gold_adv ?? []
  const xp = match.radiant_xp_adv ?? []
  const n = Math.max(gold.length, xp.length)
  if (n < 2) return <Empty height={vbH} />

  const prob = Array.from({ length: n }, (_, i) => {
    const adv = (gold[i] ?? 0) + 0.5 * (xp[i] ?? 0)
    return 1 / (1 + Math.exp(-adv / 5000))
  })
  const pad = 8
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (p: number) => vbH - pad - p * (vbH - 2 * pad)
  const mid = yAt(0.5)
  const pts: [number, number][] = prob.map((p, i) => [xAt(i), yAt(p)])
  const area = `${toPath(pts)} L${xAt(n - 1)} ${mid} L0 ${mid} Z`

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHoverIdx(Math.round(f * (n - 1)))
  }
  const hp = hoverIdx != null ? prob[Math.min(hoverIdx, prob.length - 1)] : null

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={wrapRef}
        role="img"
        aria-label="Estimated win probability over time"
        className="relative"
        style={{ height: vbH }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${vbH}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: vbH }}
        >
          <title>Estimated win probability over time</title>
          <defs>
            <linearGradient id="wpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9fbf3f" stopOpacity="0.4" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#9fbf3f" stopOpacity="0.05" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#c94a38" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#c94a38" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <GridAndAxis minutes={n} vbH={vbH} />
          <line
            x1={0}
            y1={mid}
            x2={VB_W}
            y2={mid}
            stroke="#3a4147"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path d={area} fill="url(#wpFill)" />
          <path
            d={toPath(pts)}
            fill="none"
            stroke="#e8ecef"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {hoverIdx != null && (
            <line
              x1={xAt(hoverIdx)}
              y1={0}
              x2={xAt(hoverIdx)}
              y2={vbH}
              stroke="#67757f"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hp != null && hoverIdx != null && (
          <div
            className={`absolute px-2 py-1 text-[12px] tabular-nums pointer-events-none font-dota border border-slate-card ${hp >= 0.5 ? 'text-radiant' : 'text-dire'}`}
            style={{
              left: `${(hoverIdx / (n - 1)) * 100}%`,
              top: 6,
              transform: 'translateX(-50%)',
              background: 'rgba(8,10,12,0.9)',
              whiteSpace: 'nowrap',
            }}
          >
            {hoverIdx}:00 · {hp >= 0.5 ? 'Radiant' : 'Dire'}{' '}
            {Math.round((hp >= 0.5 ? hp : 1 - hp) * 100)}%
          </div>
        )}
      </div>
      <TimeLabels minutes={n} />
      <p className="mt-1 text-[11px] text-slate-muted font-dota">
        Estimated from gold and XP advantage (logistic heuristic, not a trained model).
      </p>
    </div>
  )
}

function TeamAdvantageChart({ match, vbH }: { match: Match; vbH: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const gold = match.radiant_gold_adv ?? []
  const xp = match.radiant_xp_adv ?? []
  const n = Math.max(gold.length, xp.length)
  if (n < 2) return <Empty height={vbH} />
  const mid = vbH / 2
  const maxAbs = Math.max(1, ...gold.map(Math.abs), ...xp.map(Math.abs))
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (v: number) => mid - (v / maxAbs) * (mid - 8)

  const goldPts: [number, number][] = gold.map((v, i) => [xAt(i), yAt(v)])
  const xpPts: [number, number][] = xp.map((v, i) => [xAt(i), yAt(v)])

  // Area fill for gold advantage (green above midline, red below)
  const goldArea = `${toPath(goldPts)} L${xAt(n - 1)} ${mid} L0 ${mid} Z`

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
      <div
        ref={wrapRef}
        role="img"
        aria-label="Team net worth and XP advantage over time"
        className="relative"
        style={{ height: vbH }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${vbH}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: vbH }}
        >
          <title>Team net worth and XP advantage over time</title>
          <defs>
            <linearGradient id="advGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9fbf3f" stopOpacity="0.35" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#9fbf3f" stopOpacity="0.05" />
              <stop offset={`${(mid / vbH) * 100}%`} stopColor="#c94a38" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#c94a38" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <GridAndAxis minutes={n} vbH={vbH} />
          <line
            x1={0}
            y1={mid}
            x2={VB_W}
            y2={mid}
            stroke="#3a4147"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path d={goldArea} fill="url(#advGreen)" />
          <path
            d={toPath(goldPts)}
            fill="none"
            stroke="#cb9b25"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={toPath(xpPts)}
            fill="none"
            stroke="#5a8fc2"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 3"
          />
          {hoverIdx != null && (
            <>
              <circle
                cx={xAt(hoverIdx)}
                cy={yAt(gv)}
                r={3}
                fill="#cb9b25"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={xAt(hoverIdx)}
                cy={yAt(xv)}
                r={3}
                fill="#5a8fc2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        {hoverIdx != null && (
          <>
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: `${hoverPct}%`, width: 1, background: '#5a606688' }}
            />
            <div
              className="absolute pointer-events-none rounded font-dota border border-slate-border"
              style={{
                left: hoverPct > 55 ? undefined : `calc(${hoverPct}% + 10px)`,
                right: hoverPct > 55 ? `calc(${100 - hoverPct}% + 10px)` : undefined,
                top: 6,
                background: '#0b0d0f',
                padding: '6px 8px',
                zIndex: 5,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-1 tabular-nums text-slate-muted">
                {hoverIdx}:00
              </div>
              <div className="flex items-center gap-1.5 text-[11px] leading-tight">
                <span
                  className="rounded-sm"
                  style={{ width: 8, height: 8, background: '#cb9b25' }}
                />
                <span style={{ color: '#b8c2c9' }}>Net Worth</span>
                <span
                  className={`ml-auto tabular-nums font-semibold ${gv >= 0 ? 'text-radiant' : 'text-dire'}`}
                >
                  {advLabel(gv)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] leading-tight mt-0.5">
                <span
                  className="rounded-sm"
                  style={{ width: 8, height: 8, background: '#5a8fc2' }}
                />
                <span style={{ color: '#b8c2c9' }}>XP</span>
                <span
                  className={`ml-auto tabular-nums font-semibold ${xv >= 0 ? 'text-radiant' : 'text-dire'}`}
                >
                  {advLabel(xv)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      <TimeLabels minutes={n} />
      <div className="flex items-center gap-4 mt-1 text-[11px] font-dota">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[2px]" style={{ background: '#cb9b25' }} />
          <span className="text-slate-muted-light">Net Worth adv.</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[2px]" style={{ background: '#5a8fc2' }} />
          <span className="text-slate-muted-light">XP adv.</span>
        </span>
        <span className="ml-auto text-slate-muted">Positive = Radiant ahead</span>
      </div>
    </div>
  )
}

function PlayerLinesChart({
  match,
  heroStats,
  metric,
  visibleSlots,
  vbH,
}: {
  match: Match
  heroStats: HeroStat[]
  metric: 'networth' | 'level' | 'lasthits'
  visibleSlots: Set<number>
  vbH: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const players = match.players
  const series = players.map((p) => {
    const raw =
      metric === 'networth'
        ? (p.gold_t ?? [])
        : metric === 'lasthits'
          ? (p.lh_t ?? [])
          : (p.xp_t ?? [])
    const data = metric === 'level' ? raw.map(levelFromXp) : raw
    return { player: p, data }
  })
  const n = Math.max(0, ...series.map((s) => s.data.length))
  if (n < 2) return <Empty height={vbH} />

  // Only draw selected players; rescale the y-axis to what's shown so a single
  // focused player fills the chart.
  const shown = series.filter((s) => visibleSlots.has(s.player.player_slot))
  const active = shown.length > 0 ? shown : series

  const pad = 10
  const maxVal = metric === 'level' ? 30 : Math.max(1, ...active.flatMap((s) => s.data))
  const xAt = (i: number) => (i / (n - 1)) * VB_W
  const yAt = (v: number) => vbH - pad - (v / maxVal) * (vbH - 2 * pad)

  const yTicks =
    metric === 'level'
      ? [5, 10, 15, 20, 25, 30].map((lv) => ({ y: yAt(lv), label: String(lv) }))
      : [0.25, 0.5, 0.75, 1].map((f) => ({
          y: yAt(maxVal * f),
          label: fmtGold(Math.round(maxVal * f)),
        }))

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

  const metricLabel =
    metric === 'networth' ? 'net worth' : metric === 'level' ? 'level' : 'last hits'

  return (
    <div className="flex-1 min-w-0">
      <div
        ref={wrapRef}
        role="img"
        aria-label={`Player ${metricLabel} over time`}
        className="relative"
        style={{ height: vbH }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${vbH}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: vbH }}
        >
          <title>Player {metricLabel} over time</title>
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
                strokeWidth={shown.length === 1 ? 3 : 2.25}
                strokeOpacity={0.9}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {hoverIdx != null &&
            shown.map((s) => {
              const color = PLAYER_COLORS[s.player.player_slot] ?? '#888'
              const v = s.data[Math.min(hoverIdx, s.data.length - 1)] ?? 0
              return (
                <circle
                  key={s.player.player_slot}
                  cx={xAt(hoverIdx)}
                  cy={yAt(v)}
                  r={3}
                  fill={color}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
        </svg>

        {hoverIdx != null && (
          <>
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: `${hoverPct}%`, width: 1, background: '#5a606688' }}
            />
            <div
              className="absolute pointer-events-none rounded font-dota border border-slate-border"
              style={{
                left: hoverPct > 55 ? undefined : `calc(${hoverPct}% + 10px)`,
                right: hoverPct > 55 ? `calc(${100 - hoverPct}% + 10px)` : undefined,
                top: 6,
                background: '#0b0d0f',
                padding: '6px 8px',
                minWidth: 130,
                zIndex: 5,
              }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-1 tabular-nums text-slate-muted">
                {hoverIdx}:00
              </div>
              {hoverRows.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-1.5 text-[11px] leading-tight py-0.5"
                >
                  <span
                    className="shrink-0 rounded-sm"
                    style={{ width: 3, height: 16, background: r.color }}
                  />
                  {r.hero && (
                    <img
                      src={heroIconUrl(r.hero.name)}
                      alt=""
                      className="shrink-0 rounded-sm"
                      style={{ width: 18, height: 18 }}
                      onError={(e) => {
                        const img = e.currentTarget
                        img.onerror = null
                        img.src = heroIconFromPath(r.hero?.icon ?? '')
                      }}
                    />
                  )}
                  <span className="flex-1 min-w-0 truncate" style={{ color: '#b8c2c9' }}>
                    {r.name}
                  </span>
                  <span className="tabular-nums font-semibold ml-2 text-slate-foreground">
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
  rowH,
  headerH,
}: {
  match: Match
  itemConst: Record<string, ItemConst>
  rowH: number
  headerH: number
}) {
  const { radiant, dire } = orderedTeams(match)
  const durationSec = Math.max(1, match.duration)

  const rosterH = 2 * headerH + 10 * rowH
  // Compute each player's row y-center to align with the sidebar.
  const rowY = (isRadiant: boolean, idx: number) => {
    const base = isRadiant ? 0 : headerH + 5 * rowH
    return base + headerH + idx * rowH + rowH / 2
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
          style={{
            top: y,
            left: 0,
            right: 0,
            height: 2,
            background: color,
            opacity: 0.35,
            transform: 'translateY(-50%)',
          }}
        />
        {purchases.map((e) => {
          const leftPct = Math.max(0, Math.min(100, (e.time / durationSec) * 100))
          return (
            <div
              key={`${e.key}-${e.time}`}
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
      <div
        key={mm}
        className="absolute top-0 bottom-0 bg-slate-bg"
        style={{ left: `${((mm * 60) / durationSec) * 100}%`, width: 1 }}
      >
        <span
          className="absolute text-[11px] tabular-nums text-slate-muted font-dota"
          style={{ top: '50%', left: 4 }}
        >
          {mm}:00
        </span>
      </div>,
    )
  }

  const hasAny = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  if (!hasAny) return <Empty height={rosterH} />

  return (
    <div className="flex-1 min-w-0 relative" style={{ height: rosterH }}>
      {grid}
      {radiant.map((p, i) => renderRow(p, true, i))}
      {dire.map((p, i) => renderRow(p, false, i))}
    </div>
  )
}

function Empty({ height }: { height: number }) {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ height }}>
      <span className="text-sm text-slate-muted font-dota">
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
  // All four client modes are always offered; modes without parsed data render
  // the "unparsed" placeholder in the chart area.
  const available: Mode[] = ['team', 'winprob', 'networth', 'level', 'lasthits', 'items']

  const [mode, setMode] = useState<Mode>('team')
  const activeMode = mode
  // Size the roster + chart to exactly fill the viewport below the tab strip.
  const { ref: fitRef, rowH, headerH, rosterH } = useRosterMetrics()

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
  const perPlayerMode =
    activeMode === 'networth' || activeMode === 'level' || activeMode === 'lasthits'

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
    const leftover = team
      .filter((p) => !used.has(p.player_slot))
      .sort((a, b) => b.net_worth - a.net_worth)
    for (let i = 0; i < 5; i++) if (!out[i]) out[i] = leftover.shift()
    return out
  }
  const radPos = derivePositions(radTeam)
  const direPos = derivePositions(direTeam)
  const POSITIONS = ['Safelane', 'Midlane', 'Offlane', 'Soft Support', 'Hard Support']
  const positionSlots = (i: number) => {
    const slots = new Set<number>()
    const rp = radPos[i]
    const dp = direPos[i]
    if (rp) slots.add(rp.player_slot)
    if (dp) slots.add(dp.player_slot)
    return slots
  }
  const selectPosition = (i: number) => {
    const slots = positionSlots(i)
    if (slots.size) setVisibleSlots(slots)
  }
  const allSlots = () => setVisibleSlots(new Set(match.players.map((p) => p.player_slot)))

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 980 }}>
        {/* Mode toggle (full width) */}
        <div className="flex gap-2 mb-3" style={{ marginLeft: SIDEBAR_W + 16 }}>
          {available.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 px-3 py-2.5 text-[13px] uppercase transition-colors cursor-pointer font-dota ${activeMode === m ? 'text-white' : 'text-slate-muted-light'}`}
              style={{
                letterSpacing: '1px',
                background: activeMode === m ? '#5c666c' : 'rgba(22,26,29,0.85)',
                border: `1px solid ${activeMode === m ? '#6e787e' : '#242a2e'}`,
              }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {perPlayerMode && (
          <div
            className="flex items-center gap-1.5 mb-2 flex-wrap font-dota"
            style={{ marginLeft: SIDEBAR_W + 16 }}
          >
            <span className="text-[11px] mr-1 text-slate-muted">
              Showing {visibleSlots.size}/{match.players.length}:
            </span>
            <button
              type="button"
              onClick={allSlots}
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border border-slate-bg ${visibleSlots.size === match.players.length ? 'text-slate-foreground-light bg-slate-card' : 'text-slate-muted-light'}`}
              style={{
                background: visibleSlots.size === match.players.length ? undefined : '#15181b',
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
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border border-slate-bg ${isActive ? 'text-slate-foreground-light bg-slate-card' : 'text-slate-muted-light'}`}
                  style={{ background: isActive ? undefined : '#15181b' }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        <div ref={fitRef} className="flex gap-4">
          {/* Roster sidebar — interactive legend in per-player modes */}
          <MatchRosterSidebar
            match={match}
            heroStats={heroStats}
            width={SIDEBAR_W}
            interactive={perPlayerMode}
            visibleSlots={perPlayerMode ? visibleSlots : undefined}
            onToggle={toggleSlot}
            showColors={perPlayerMode}
            rowH={rowH}
            headerH={headerH}
          />

          {/* Chart column — dark backdrop so line colors stay readable */}
          <div className="flex-1 min-w-0" style={{ background: 'rgba(10,13,15,0.82)' }}>
            {/* Line charts render time labels (and a legend) below the plot,
                so shrink their viewbox to keep the column at roster height. */}
            {activeMode === 'team' && <TeamAdvantageChart match={match} vbH={rosterH - 46} />}
            {activeMode === 'winprob' && <WinProbChart match={match} vbH={rosterH - 46} />}
            {activeMode === 'networth' && (
              <PlayerLinesChart
                match={match}
                heroStats={heroStats}
                metric="networth"
                visibleSlots={visibleSlots}
                vbH={rosterH - 22}
              />
            )}
            {activeMode === 'level' && (
              <PlayerLinesChart
                match={match}
                heroStats={heroStats}
                metric="level"
                visibleSlots={visibleSlots}
                vbH={rosterH - 22}
              />
            )}
            {activeMode === 'lasthits' && (
              <PlayerLinesChart
                match={match}
                heroStats={heroStats}
                metric="lasthits"
                visibleSlots={visibleSlots}
                vbH={rosterH - 22}
              />
            )}
            {activeMode === 'items' && (
              <PlayerItemsTimeline
                match={match}
                itemConst={itemConst}
                rowH={rowH}
                headerH={headerH}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
