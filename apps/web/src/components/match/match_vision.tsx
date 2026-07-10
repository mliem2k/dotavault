import { useEffect, useMemo, useRef, useState } from 'react'
import type { HeroStat, MatchPlayer } from 'types'
import { formatDuration, heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { PlayerNameLink } from './match_roster'
import { GameTimeSlider } from './match_time'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF',
  1: '#66FFBF',
  2: '#BF00BF',
  3: '#F3F00B',
  4: '#FF6600',
  128: '#FE87C4',
  129: '#A1B477',
  130: '#65D9F7',
  131: '#007A00',
  132: '#A46900',
}

const C = {
  dim: '#67757f',
  label: '#8a97a0',
  text: '#cfd4d8',
  white: '#ffffff',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

// OpenDota ward logs use world grid cells (~64..192), not 0..127.
const MAP_MIN = 64
const MAP_MAX = 192
const CANVAS_SIZE = 1120 // backing resolution; displayed at 560px for sharpness
const DISPLAY_SIZE = 560

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
}

type LiveWard = {
  x: number
  y: number
  time: number
  until: number | null
  obs: boolean
  slot: number
}

/* Pair each placed ward with its removal entry (same map cell, first removal
   after placement) so scrubbing can show only wards alive at a given time. */
function computeWards(players: MatchPlayer[]): LiveWard[] {
  const out: LiveWard[] = []
  for (const p of players) {
    const pair = (placed: typeof p.obs_log, left: typeof p.obs_left_log, obs: boolean) => {
      const removals = [...(left ?? [])].sort((a, b) => a.time - b.time)
      const used = new Set<number>()
      for (const w of placed ?? []) {
        let until: number | null = null
        for (let i = 0; i < removals.length; i++) {
          const r = removals[i]
          if (!used.has(i) && r.x === w.x && r.y === w.y && r.time >= w.time) {
            until = r.time
            used.add(i)
            break
          }
        }
        out.push({ x: w.x, y: w.y, time: w.time, until, obs, slot: p.player_slot })
      }
    }
    pair(p.obs_log, p.obs_left_log, true)
    pair(p.sen_log, p.sen_left_log, false)
  }
  return out
}

export function MatchVision({
  players,
  heroStats,
  duration,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
  duration: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  // Hit-test registry, filled during draw() in canvas backing coordinates.
  const markersRef = useRef<
    {
      cx: number
      cy: number
      r: number
      obs: boolean
      slot: number
      time: number
      until: number | null
    }[]
  >([])
  const [hover, setHover] = useState<{
    x: number
    y: number
    obs: boolean
    slot: number
    time: number
    until: number | null
  } | null>(null)
  const [timeSec, setTimeSec] = useState<number>(duration)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [mode, setMode] = useState<'all' | 'radiant' | 'dire' | 'both'>('all')
  // 'placed' = every ward placed up to the scrub time; 'active' = only wards
  // still standing at that moment.
  const [scope, setScope] = useState<'placed' | 'active'>('placed')
  const wards = useMemo(() => computeWards(players), [players])
  const wardsRef = useRef(wards)
  wardsRef.current = wards
  const timeRef = useRef(timeSec)
  timeRef.current = timeSec
  const selectedRef = useRef(selectedSlot)
  selectedRef.current = selectedSlot
  const modeRef = useRef(mode)
  modeRef.current = mode
  const scopeRef = useRef(scope)
  scopeRef.current = scope

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))

  const hasData = players.some((p) => (p.obs_log?.length ?? 0) > 0 || (p.sen_log?.length ?? 0) > 0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally load the minimap image once on mount; draw is redefined every render, so listing it would reload the static image on every render instead of once
  useEffect(() => {
    const img = new Image()
    img.src = '/minimap.webp'
    img.onload = () => {
      mapImgRef.current = img
      draw()
    }
  }, [])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = canvas.width
    const k = size / 560 // scale factor for marker sizes

    ctx.clearRect(0, 0, size, size)
    if (mapImgRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, size, size)
    } else {
      ctx.fillStyle = '#0a1a0a'
      ctx.fillRect(0, 0, size, size)
    }

    markersRef.current = []
    const t = timeRef.current
    const sel = selectedRef.current
    const m = modeRef.current
    const teamOf = (slot: number) => (slot < 128 ? 'radiant' : 'dire')
    const teamVisible = (slot: number) => (m === 'all' || m === 'both' ? true : teamOf(slot) === m)
    const isAlive = (w: (typeof wardsRef.current)[number]) =>
      w.time <= t && (w.until == null || w.until > t)

    // Fog emulation: darken the map, then reveal each living observer ward's
    // vision circle for the selected side(s). Sentries add true-sight rings.
    if (m !== 'all') {
      const fog = document.createElement('canvas')
      fog.width = size
      fog.height = size
      const fctx = fog.getContext('2d')
      if (fctx) {
        fctx.fillStyle = 'rgba(4,8,12,0.82)'
        fctx.fillRect(0, 0, size, size)
        fctx.globalCompositeOperation = 'destination-out'
        const visionR = size * (1600 / 16384) // observer ward vision range
        for (const w of wardsRef.current) {
          if (!w.obs || !isAlive(w) || !teamVisible(w.slot)) continue
          if (sel != null && w.slot !== sel) continue
          const cx = toCanvas(w.x, size)
          const cy = size - toCanvas(w.y, size)
          const g = fctx.createRadialGradient(cx, cy, visionR * 0.55, cx, cy, visionR)
          g.addColorStop(0, 'rgba(0,0,0,1)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          fctx.fillStyle = g
          fctx.beginPath()
          fctx.arc(cx, cy, visionR, 0, Math.PI * 2)
          fctx.fill()
        }
        ctx.drawImage(fog, 0, 0)
        // sentry true-sight rings on top of the fog
        const sightR = size * (1000 / 16384)
        for (const w of wardsRef.current) {
          if (w.obs || !isAlive(w) || !teamVisible(w.slot)) continue
          if (sel != null && w.slot !== sel) continue
          const cx = toCanvas(w.x, size)
          const cy = size - toCanvas(w.y, size)
          ctx.beginPath()
          ctx.arc(cx, cy, sightR, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(101,169,217,0.55)'
          ctx.lineWidth = 1.5 * k
          ctx.setLineDash([6 * k, 5 * k])
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = 'rgba(101,169,217,0.10)'
          ctx.fill()
        }
      }
    }

    const scopeVisible = (w: (typeof wardsRef.current)[number]) =>
      scopeRef.current === 'active' ? isAlive(w) : w.time <= t
    for (const ward of wardsRef.current) {
      if (!scopeVisible(ward)) continue
      if (!teamVisible(ward.slot)) continue
      if (sel != null && ward.slot !== sel) continue
      const color = PLAYER_COLORS[ward.slot] ?? '#888'
      const cx = toCanvas(ward.x, size)
      const cy = size - toCanvas(ward.y, size)

      if (ward.obs) {
        markersRef.current.push({
          cx,
          cy,
          r: 9 * k,
          obs: true,
          slot: ward.slot,
          time: ward.time,
          until: ward.until,
        })
        ctx.beginPath()
        ctx.arc(cx, cy, 9 * k, 0, Math.PI * 2)
        ctx.fillStyle = `${color}cc`
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5 * k
        ctx.stroke()
        // eye icon: small dot inside
        ctx.beginPath()
        ctx.arc(cx, cy, 3.5 * k, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      } else {
        markersRef.current.push({
          cx,
          cy,
          r: 10 * k,
          obs: false,
          slot: ward.slot,
          time: ward.time,
          until: ward.until,
        })
        // Sentry: diamond shape
        ctx.beginPath()
        ctx.moveTo(cx, cy - 10 * k)
        ctx.lineTo(cx + 8 * k, cy)
        ctx.lineTo(cx, cy + 10 * k)
        ctx.lineTo(cx - 8 * k, cy)
        ctx.closePath()
        ctx.fillStyle = `${color}99`
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5 * k
        ctx.stroke()
      }
    }
  }

  useEffect(() => {
    draw()
  })

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm font-dota text-slate-muted">
          No ward data available for this match.
        </span>
      </div>
    )
  }

  const obsTotal = players.reduce((s, p) => s + (p.obs_log?.length ?? 0), 0)
  const senTotal = players.reduce((s, p) => s + (p.sen_log?.length ?? 0), 0)
  const warders = players.filter((p) => (p.obs_log?.length ?? 0) + (p.sen_log?.length ?? 0) > 0)

  return (
    <div className="flex gap-4 flex-wrap items-start font-dota">
      {/* Ward map */}
      <div style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3 text-white"
          style={{ letterSpacing: '2px', background: C.panelDark }}
        >
          Ward Map
        </div>
        <div className="flex gap-1.5 px-3 pt-3">
          {(
            [
              ['all', 'All Vision'],
              ['radiant', 'Radiant'],
              ['dire', 'Dire'],
              ['both', 'Both'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 px-2 py-1.5 text-[12px] uppercase cursor-pointer ${mode === value ? 'text-white' : 'text-slate-muted-light'}`}
              style={{
                letterSpacing: '1px',
                background: mode === value ? '#5c666c' : 'rgba(22,26,29,0.85)',
                border: `1px solid ${mode === value ? '#6e787e' : '#242a2e'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 px-3 pt-1.5">
          {(
            [
              ['placed', 'Placed up to time'],
              ['active', 'Active at time'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`flex-1 px-2 py-1.5 text-[12px] uppercase cursor-pointer ${scope === value ? 'text-white' : 'text-slate-muted-light'}`}
              style={{
                letterSpacing: '1px',
                background: scope === value ? '#5c666c' : 'rgba(22,26,29,0.85)',
                border: `1px solid ${scope === value ? '#6e787e' : '#242a2e'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3 relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              width: DISPLAY_SIZE,
              height: DISPLAY_SIZE,
              display: 'block',
              cursor: hover ? 'pointer' : 'default',
            }}
            onMouseMove={(e) => {
              const canvas = canvasRef.current
              if (!canvas) return
              const rect = canvas.getBoundingClientRect()
              const dx = e.clientX - rect.left
              const dy = e.clientY - rect.top
              const scale = canvas.width / rect.width
              const px = dx * scale
              const py = dy * scale
              let best: (typeof markersRef.current)[number] | null = null
              let bestDist = Number.POSITIVE_INFINITY
              for (const m of markersRef.current) {
                const d = Math.hypot(m.cx - px, m.cy - py)
                if (d <= m.r + 4 * (scale / 2) && d < bestDist) {
                  best = m
                  bestDist = d
                }
              }
              setHover(
                best
                  ? {
                      x: dx,
                      y: dy,
                      obs: best.obs,
                      slot: best.slot,
                      time: best.time,
                      until: best.until,
                    }
                  : null,
              )
            }}
            onMouseLeave={() => setHover(null)}
          />
          {hover &&
            (() => {
              const player = players.find((p) => p.player_slot === hover.slot)
              const hero = player ? heroMap.get(player.hero_id) : undefined
              const color = PLAYER_COLORS[hover.slot] ?? '#888'
              const flipX = hover.x > DISPLAY_SIZE - 190
              const flipY = hover.y > DISPLAY_SIZE - 90
              return (
                <div
                  className="absolute z-10 pointer-events-none border border-slate-border"
                  style={{
                    left: flipX ? undefined : hover.x + 26,
                    right: flipX ? DISPLAY_SIZE - hover.x + 10 : undefined,
                    top: flipY ? undefined : hover.y + 24,
                    bottom: flipY ? DISPLAY_SIZE - hover.y + 8 : undefined,
                    background: 'rgba(10,13,15,0.96)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
                    padding: '8px 12px',
                    minWidth: 170,
                  }}
                >
                  <div
                    className={`text-[13px] uppercase mb-1 ${hover.obs ? 'text-gold' : ''}`}
                    style={{ color: hover.obs ? undefined : '#65a9d9', letterSpacing: '1px' }}
                  >
                    {hover.obs ? '● Observer Ward' : '◆ Sentry Ward'}
                  </div>
                  <div className="flex items-center gap-2">
                    {hero && (
                      <img
                        src={heroIconUrl(hero.name)}
                        alt=""
                        style={{ width: 26, height: 26, borderLeft: `3px solid ${color}` }}
                        onError={(e) => {
                          const img = e.currentTarget
                          img.onerror = null
                          img.src = heroIconFromPath(hero.icon)
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[14px] truncate text-white">{hero?.localized_name}</div>
                      <div className="text-[11px] truncate text-slate-muted">
                        {player?.personaname ?? 'Anonymous'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-[13px] tabular-nums text-slate-foreground">
                    Placed at{' '}
                    <span className="text-white">{formatDuration(Math.max(0, hover.time))}</span>
                    {hover.until != null && (
                      <>
                        {' '}
                        · until{' '}
                        <span className="text-white">
                          {formatDuration(Math.max(0, hover.until))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
        </div>
        <div className="px-3 pb-3">
          <GameTimeSlider timeSec={timeSec} duration={duration} onChange={setTimeSec} />
        </div>
      </div>

      {/* Legend + per-player counts */}
      <div className="flex-1 min-w-[320px] max-w-[520px]" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3 text-white"
          style={{ letterSpacing: '2px', background: C.panelDark }}
        >
          Wards Placed
        </div>
        <div className="px-4 py-3">
          <div
            className="flex gap-8 pb-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-[15px] text-slate-muted-light">
              ● Observers{' '}
              <span className="ml-1 text-[17px] tabular-nums text-white">{obsTotal}</span>
            </span>
            <span className="text-[15px] text-slate-muted-light">
              ◆ Sentries{' '}
              <span className="ml-1 text-[17px] tabular-nums text-white">{senTotal}</span>
            </span>
          </div>
          {warders.map((p) => {
            const hero = heroMap.get(p.hero_id)
            const color = PLAYER_COLORS[p.player_slot] ?? '#888'
            const obs = p.obs_log?.length ?? 0
            const sen = p.sen_log?.length ?? 0
            const active = selectedSlot === p.player_slot
            const dimmed = selectedSlot != null && !active
            return (
              // biome-ignore lint/a11y/useSemanticElements: contains a nested <a> (PlayerNameLink), invalid inside a real <button>
              <div
                key={p.player_slot}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSlot(active ? null : p.player_slot)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSlot(active ? null : p.player_slot)
                  }
                }}
                className="flex items-center gap-3 py-2.5 w-full text-left cursor-pointer hover:bg-white/[0.05]"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: active ? 'rgba(255,255,255,0.09)' : undefined,
                  boxShadow: active ? `inset 3px 0 0 ${color}` : undefined,
                  opacity: dimmed ? 0.45 : 1,
                }}
              >
                <span style={{ width: 4, height: 30, background: color }} />
                {hero && (
                  <img
                    src={heroIconUrl(hero.name)}
                    alt=""
                    style={{ width: 34, height: 34 }}
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      img.src = heroIconFromPath(hero.icon)
                    }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] truncate text-white">{hero?.localized_name}</div>
                  <PlayerNameLink
                    player={p}
                    className="block text-[12px] truncate text-slate-muted"
                  />
                </div>
                <span className="text-[15px] tabular-nums shrink-0 text-slate-foreground">
                  ● {obs}
                </span>
                <span className="text-[15px] tabular-nums shrink-0 w-12 text-slate-foreground">
                  ◆ {sen}
                </span>
              </div>
            )
          })}
          <div className="pt-2 text-[12px] text-slate-muted">
            Click a player to show only their wards.
          </div>
        </div>
      </div>
    </div>
  )
}
