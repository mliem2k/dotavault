import { Pause, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { HeroStat, Match, TeamfightPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import { formatDuration } from '@/lib/utils'

// OpenDota heatmap grid: 0–127 on each axis
const MAP_MIN = 0
const MAP_MAX = 127

type HeroPos = { time: number; x: number; y: number; slot: number }

function extractPositions(match: Match): HeroPos[] {
  const positions: HeroPos[] = []
  if (!match.teamfights) return positions
  for (const fight of match.teamfights) {
    fight.players.forEach((p: TeamfightPlayer, slot: number) => {
      if (p.x != null && p.y != null) {
        positions.push({ time: fight.start, x: p.x, y: p.y, slot })
        positions.push({ time: fight.end, x: p.x, y: p.y, slot })
      }
    })
  }
  return positions.sort((a, b) => a.time - b.time)
}

function interpolate(slotPositions: HeroPos[], t: number): { x: number; y: number } | null {
  if (!slotPositions.length) return null
  const before = [...slotPositions].reverse().find((p) => p.time <= t)
  const after = slotPositions.find((p) => p.time > t)
  if (!before) return after ? { x: after.x, y: after.y } : null
  if (!after) return { x: before.x, y: before.y }
  const f = (t - before.time) / (after.time - before.time)
  return { x: before.x + (after.x - before.x) * f, y: before.y + (after.y - before.y) * f }
}

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
}

type ParseState = 'idle' | 'requesting' | 'submitted' | 'error'

function ParseRequest({ matchId }: { matchId: number }) {
  const [state, setState] = useState<ParseState>('idle')

  async function request() {
    setState('requesting')
    try {
      await opendota.requestParse(String(matchId))
      setState('submitted')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
      <p className="text-sm text-muted">
        This match has not been parsed yet. Request a parse to enable the replay viewer.
      </p>
      {state === 'submitted' ? (
        <p className="text-sm text-radiant">
          Parse requested — reload the page in a few minutes to check if data is available.
        </p>
      ) : state === 'error' ? (
        <p className="text-sm text-dire">Failed to request parse. Try again later.</p>
      ) : (
        <button
          onClick={request}
          disabled={state === 'requesting'}
          className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'requesting' ? 'animate-spin' : ''}`} />
          {state === 'requesting' ? 'Requesting…' : 'Request Parse'}
        </button>
      )}
    </div>
  )
}

export function ReplayViewer({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const animRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const heroMap = useMemo(
    () => new Map(heroStats.map((h) => [h.id, h])),
    [heroStats],
  )
  const positions = useMemo(() => extractPositions(match), [match])
  const positionsBySlot = useMemo(() => {
    const map = new Map<number, HeroPos[]>()
    for (const p of positions) {
      if (!map.has(p.slot)) map.set(p.slot, [])
      map.get(p.slot)!.push(p)
    }
    return map
  }, [positions])
  const duration = match.duration

  const activeTeamfight = match.teamfights?.find((tf) => time >= tf.start && time <= tf.end)

  useEffect(() => {
    const img = new Image()
    img.src = '/minimap.webp'
    img.onload = () => {
      mapImgRef.current = img
    }
  }, [])

  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const size = canvas.width

      ctx.clearRect(0, 0, size, size)

      if (mapImgRef.current) {
        ctx.drawImage(mapImgRef.current, 0, 0, size, size)
      } else {
        ctx.fillStyle = '#0a1a0a'
        ctx.fillRect(0, 0, size, size)
      }

      if (activeTeamfight) {
        const pts = activeTeamfight.players
          .filter((p) => p.x != null && p.y != null)
          .map((p) => ({
            x: toCanvas(p.x!, size),
            y: size - toCanvas(p.y!, size),
          }))
        if (pts.length) {
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
          const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
          const alpha = 0.3 + 0.2 * Math.sin(t * 4)
          ctx.beginPath()
          ctx.arc(cx, cy, 32, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255, 200, 50, ${alpha})`
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      match.players.forEach((player, slot) => {
        const pos = interpolate(positionsBySlot.get(slot) ?? [], t)
        if (!pos) return
        const cx = toCanvas(pos.x, size)
        const cy = size - toCanvas(pos.y, size)
        const isRadiant = player.player_slot < 128

        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fillStyle = isRadiant ? '#4ade80' : '#f87171'
        ctx.fill()
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.stroke()

        const hero = heroMap.get(player.hero_id)
        if (hero) {
          ctx.fillStyle = '#fff'
          ctx.font = '9px monospace'
          ctx.fillText(hero.localized_name.slice(0, 4), cx + 6, cy + 3)
        }
      })
    },
    [match, positionsBySlot, heroMap, activeTeamfight],
  )

  useEffect(() => {
    draw(time)
  }, [time, draw])

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      lastTsRef.current = null
      return
    }
    function tick(ts: number) {
      if (lastTsRef.current === null) lastTsRef.current = ts
      const delta = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      setTime((prev) => {
        const next = prev + delta
        if (next >= duration) {
          setPlaying(false)
          return duration
        }
        return next
      })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [playing, duration])

  if (match.version === null) {
    return <ParseRequest matchId={match.match_id} />
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted">No teamfight position data available for this match.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <motion.div whileTap={{ scale: 0.9 }} style={{ display: 'inline-flex' }}>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card hover:bg-white/10"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <input
            type="range"
            min={0}
            max={duration}
            value={time}
            onChange={(e) => {
              setPlaying(false)
              setTime(Number(e.target.value))
            }}
            className="flex-1 accent-accent"
          />
        </motion.div>
        <span className="w-12 text-right font-mono text-xs text-muted">
          {formatDuration(Math.floor(time))}
        </span>
      </div>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="rounded-lg border border-border"
        />
      </div>
      {activeTeamfight && (
        <p className="text-center text-xs text-muted">
          ⚔ Teamfight {formatDuration(activeTeamfight.start)}–
          {formatDuration(activeTeamfight.end)} · {activeTeamfight.deaths} deaths
        </p>
      )}
    </div>
  )
}
