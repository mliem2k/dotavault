import { Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { HeroStat, Match, TeamfightPlayer } from 'types'
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

function interpolate(positions: HeroPos[], slot: number, t: number): { x: number; y: number } | null {
  const hp = positions.filter((p) => p.slot === slot)
  if (!hp.length) return null
  const before = [...hp].reverse().find((p) => p.time <= t)
  const after = hp.find((p) => p.time > t)
  if (!before) return after ? { x: after.x, y: after.y } : null
  if (!after) return { x: before.x, y: before.y }
  const f = (t - before.time) / (after.time - before.time)
  return { x: before.x + (after.x - before.x) * f, y: before.y + (after.y - before.y) * f }
}

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
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
  const positions = extractPositions(match)
  const duration = match.duration

  const activeTeamfight = match.teamfights?.find((tf) => time >= tf.start && time <= tf.end)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = 'https://cdn.opendota.com/apps/dota2/images/dota_react/map/minimap.png'
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
        const pos = interpolate(positions, slot, t)
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
    [match, positions, heroMap, activeTeamfight],
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

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-xs text-muted">
        Replay data unavailable — this match may not have been parsed yet.
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
