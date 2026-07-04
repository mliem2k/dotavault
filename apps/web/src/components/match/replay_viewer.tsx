import { Pause, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HeroStat, Match } from 'types'
import { opendota } from '@/lib/opendota'
import { ReplayUnavailableError, parseReplayPositions } from '@/lib/replay_parser'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { type ObjectiveEvent, extractObjectiveEvents } from './match_objectives'
import { formatClock, GameTimeSlider } from './match_time'

/* Replay / playback tab. OpenDota's parsed data only ever gives two kinds of
   anchored positions: where a hero died in a teamfight
   (teamfights[].players[].deaths_pos, a sparse per-fight heatmap) and where
   they placed wards (obs_log/sen_log). Both use the same ~64-192 world grid
   as the Vision tab's ward map (NOT 0-127). By default heroes are
   interpolated between whichever of these anchors are known, shown dimmed
   ("ghost") outside their known time range rather than guessing a
   fabricated position.

   "Full Playback" is an upgrade path: while Valve is still actually serving
   the match's raw replay file (a short window after the match ends), our
   own Go service (apps/replay-parser) downloads and parses it directly with
   manta to get true continuous hero movement, replacing the sparse
   snapshots above entirely once it loads. */

const MAP_MIN = 64
const MAP_MAX = 192

const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type Waypoint = { time: number; x: number; y: number }

function extractDeathWaypoints(match: Match): Waypoint[][] {
  const bySlot: Waypoint[][] = match.players.map(() => [])
  for (const tf of match.teamfights ?? []) {
    tf.players.forEach((tp, idx) => {
      const dp = tp.deaths_pos
      if (!dp) return
      let best: { x: number; y: number; count: number } | null = null
      for (const [xk, inner] of Object.entries(dp)) {
        for (const [yk, count] of Object.entries(inner)) {
          if (!best || count > best.count) best = { x: Number(xk), y: Number(yk), count }
        }
      }
      if (best) bySlot[idx]?.push({ time: tf.last_death ?? tf.end, x: best.x, y: best.y })
    })
  }
  return bySlot
}

function extractWardWaypoints(match: Match): Waypoint[][] {
  return match.players.map((p) => {
    const points: Waypoint[] = []
    for (const log of [p.obs_log, p.sen_log]) {
      for (const w of log ?? []) points.push({ time: w.time, x: w.x, y: w.y })
    }
    return points
  })
}

function buildWaypoints(match: Match): Waypoint[][] {
  const deaths = extractDeathWaypoints(match)
  const wards = extractWardWaypoints(match)
  return match.players.map((_, idx) => [...(deaths[idx] ?? []), ...(wards[idx] ?? [])].sort((a, b) => a.time - b.time))
}

type Interpolated = { x: number; y: number; ghost: boolean }

function interpolate(points: Waypoint[], t: number): Interpolated | null {
  if (!points.length) return null
  let before: Waypoint | null = null
  let after: Waypoint | null = null
  for (const p of points) {
    if (p.time <= t) before = p
    else {
      after = p
      break
    }
  }
  if (before && after) {
    const f = (t - before.time) / Math.max(1, after.time - before.time)
    return { x: before.x + (after.x - before.x) * f, y: before.y + (after.y - before.y) * f, ghost: false }
  }
  if (before) return { x: before.x, y: before.y, ghost: true }
  if (after) return { x: after.x, y: after.y, ghost: true }
  return null
}

function extractKillEvents(
  match: Match,
  heroMap: Map<number, HeroStat>,
  heroByName: Map<string, HeroStat>,
): ObjectiveEvent[] {
  const events: ObjectiveEvent[] = []
  for (const p of match.players) {
    const killerHero = heroMap.get(p.hero_id)
    for (const k of p.kills_log ?? []) {
      const victimHero = heroByName.get(k.key)
      events.push({
        time: k.time,
        icon: '⚔',
        text: `${killerHero?.localized_name ?? 'A hero'} killed ${victimHero?.localized_name ?? k.key.replace('npc_dota_hero_', '')}`,
        team: p.player_slot < 128 ? 'radiant' : 'dire',
        heroId: killerHero?.id,
      })
    }
  }
  return events
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
    <div className="p-8 text-center space-y-3" style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
      <p className="text-[14px]" style={{ color: C.dim }}>
        This match has not been parsed yet. Request a parse to enable the replay viewer.
      </p>
      {state === 'submitted' ? (
        <p className="text-[14px]" style={{ color: C.green }}>
          Parse requested, reload in a few minutes to check if data is available.
        </p>
      ) : state === 'error' ? (
        <p className="text-[14px]" style={{ color: C.red }}>Failed to request parse. Try again later.</p>
      ) : (
        <button
          type="button"
          onClick={request}
          disabled={state === 'requesting'}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:opacity-50"
          style={{ background: '#1d2a12', border: '1px solid #3d5a24', color: C.green, letterSpacing: '1px' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${state === 'requesting' ? 'animate-spin' : ''}`} />
          {state === 'requesting' ? 'Requesting…' : 'Request Parse'}
        </button>
      )}
    </div>
  )
}

const SPEEDS = [1, 2, 4, 8]

export function ReplayViewer({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const iconImgsRef = useRef<Map<number, HTMLImageElement>>(new Map())
  const animRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullPlaybackState, setFullPlaybackState] = useState<'idle' | 'loading' | 'unavailable' | 'error' | 'done'>('idle')
  const [densePositions, setDensePositions] = useState<Waypoint[][] | null>(null)

  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const heroByName = useMemo(() => new Map(heroStats.map((h) => [h.name, h])), [heroStats])
  const sparseWaypoints = useMemo(() => buildWaypoints(match), [match])
  const waypointsBySlot = densePositions ?? sparseWaypoints
  const hasAnyWaypoints = waypointsBySlot.some((w) => w.length > 0)
  const canFetchFullPlayback = match.cluster != null && match.replay_salt != null

  async function fetchFullPlayback() {
    if (match.replay_salt == null) return
    setFullPlaybackState('loading')
    try {
      const result = await parseReplayPositions(match.match_id, match.cluster, match.replay_salt)
      const bySlot: Waypoint[][] = match.players.map((p) => {
        const pts = result.positions[String(p.player_slot)] ?? []
        return pts.map((pt) => ({ time: pt.t, x: pt.x, y: pt.y }))
      })
      setDensePositions(bySlot)
      setFullPlaybackState('done')
    } catch (err) {
      setFullPlaybackState(err instanceof ReplayUnavailableError ? 'unavailable' : 'error')
    }
  }

  const events = useMemo(() => {
    const combined = [...extractObjectiveEvents(match, heroStats), ...extractKillEvents(match, heroMap, heroByName)]
    combined.sort((a, b) => a.time - b.time)
    return combined
  }, [match, heroStats, heroMap, heroByName])

  const duration = match.duration
  const activeTeamfight = match.teamfights?.find((tf) => time >= tf.start && time <= tf.end)

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
        ctx.fillStyle = 'rgba(242,201,76,0.12)'
        ctx.fillRect(0, 0, size, size)
      }

      match.players.forEach((player, idx) => {
        const pos = interpolate(waypointsBySlot[idx] ?? [], t)
        if (!pos) return
        const cx = toCanvas(pos.x, size)
        const cy = size - toCanvas(pos.y, size)
        const isRadiant = player.player_slot < 128
        const icon = iconImgsRef.current.get(player.hero_id)
        const r = 13
        const alpha = pos.ghost ? 0.4 : 1

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
        ctx.fillStyle = isRadiant ? C.green : C.red
        ctx.fill()

        if (icon?.complete && icon.naturalWidth > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(icon, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()
        }
        ctx.restore()
      })
    },
    [match, waypointsBySlot, activeTeamfight],
  )

  useEffect(() => {
    draw(time)
  }, [time, draw])

  // Images load asynchronously well after this render; loading them doesn't
  // change `time` or `draw`'s identity, so the effect above won't re-fire on
  // its own. Track both in refs and redraw directly from each image's load
  // handler instead of hoping a state bump re-triggers the effect.
  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  }, [draw])
  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  }, [time])

  useEffect(() => {
    const img = new Image()
    img.src = '/minimap.webp'
    img.onload = () => {
      mapImgRef.current = img
      drawRef.current(timeRef.current)
    }
  }, [])

  // Load hero portrait icons lazily, once per hero present in this match.
  useEffect(() => {
    for (const p of match.players) {
      if (iconImgsRef.current.has(p.hero_id)) continue
      const hero = heroMap.get(p.hero_id)
      if (!hero) continue
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = heroIconUrl(hero.name)
      img.onerror = () => {
        img.onerror = null
        img.src = heroIconFromPath(hero.icon)
      }
      img.onload = () => drawRef.current(timeRef.current)
      iconImgsRef.current.set(p.hero_id, img)
    }
  }, [match.players, heroMap])

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      lastTsRef.current = null
      return
    }
    function tick(ts: number) {
      if (lastTsRef.current === null) lastTsRef.current = ts
      const delta = ((ts - lastTsRef.current) / 1000) * speed
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
  }, [playing, duration, speed])

  if (match.version === null) return <ParseRequest matchId={match.match_id} />

  if (!hasAnyWaypoints) {
    return (
      <div className="p-8 text-center" style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
        <p className="text-[14px]" style={{ color: C.dim }}>
          No teamfight or ward position data available for this match.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-4" style={{ fontFamily: 'var(--font-dota)' }}>
      {/* Map + controls */}
      <div className="flex-1 space-y-3" style={{ background: C.panel }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: C.panelDark }}
        >
          <span className="text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px' }}>
            Playback
          </span>
          {canFetchFullPlayback && fullPlaybackState !== 'done' && (
            <div className="flex items-center gap-2.5">
              {fullPlaybackState === 'unavailable' && (
                <span className="text-[12px]" style={{ color: C.dim }}>Replay no longer available</span>
              )}
              {fullPlaybackState === 'error' && (
                <span className="text-[12px]" style={{ color: C.red }}>Failed to parse replay</span>
              )}
              <button
                type="button"
                onClick={fetchFullPlayback}
                disabled={fullPlaybackState === 'loading'}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-60"
                style={{ background: '#1d2a12', border: '1px solid #3d5a24', color: C.green, letterSpacing: '1px' }}
                title="Downloads and parses the raw replay ourselves for true continuous hero movement, only works while Valve still serves the file"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fullPlaybackState === 'loading' ? 'animate-spin' : ''}`} />
                {fullPlaybackState === 'loading' ? 'Parsing Replay…' : fullPlaybackState === 'error' ? 'Retry Full Playback' : 'Full Playback'}
              </button>
            </div>
          )}
          {fullPlaybackState === 'done' && (
            <span className="text-[12px] uppercase" style={{ color: C.green, letterSpacing: '1px' }}>
              ✓ Full playback loaded
            </span>
          )}
        </div>
        <div className="flex justify-center px-4">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="w-full max-w-[560px]"
            style={{ border: '1px solid #22282c' }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: C.text }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex items-center shrink-0" style={{ border: '1px solid #2c3236' }}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className="px-2.5 py-1.5 text-[12px] cursor-pointer"
                style={{ background: speed === s ? '#2c3236' : 'transparent', color: speed === s ? C.white : C.dim }}
              >
                {s}x
              </button>
            ))}
          </div>
          <GameTimeSlider timeSec={time} duration={duration} onChange={(t) => { setPlaying(false); setTime(t) }} />
        </div>
        {activeTeamfight && (
          <p className="text-center text-[13px] pb-3" style={{ color: C.gold }}>
            ⚔ Teamfight {formatClock(activeTeamfight.start)}–{formatClock(activeTeamfight.end)} · {activeTeamfight.deaths} deaths
          </p>
        )}
      </div>

      {/* Synced event feed */}
      <div className="w-[340px] shrink-0" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}
        >
          Match Events
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {events.map((e, i) => {
            const hero = e.heroId != null ? heroMap.get(e.heroId) : undefined
            const passed = e.time <= time
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static event list
              <button
                key={i}
                type="button"
                onClick={() => { setPlaying(false); setTime(Math.max(0, e.time)) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left cursor-pointer hover:bg-white/[0.05]"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  opacity: passed ? 1 : 0.45,
                  background: passed ? 'rgba(242,201,76,0.05)' : 'transparent',
                }}
              >
                <span className="w-11 text-right text-[13px] tabular-nums shrink-0" style={{ color: C.dim }}>
                  {formatClock(Math.max(0, e.time))}
                </span>
                <span style={{ width: 3, height: 20, background: e.team === 'radiant' ? C.green : e.team === 'dire' ? C.red : '#3a4147' }} />
                <span className="text-[15px] w-6 text-center shrink-0">{e.icon}</span>
                {hero && (
                  <img
                    src={heroIconUrl(hero.name)}
                    alt=""
                    style={{ width: 24, height: 24 }}
                    onError={(ev) => {
                      const img = ev.currentTarget
                      img.onerror = null
                      img.src = heroIconFromPath(hero.icon)
                    }}
                  />
                )}
                <span className="text-[13px] truncate" style={{ color: C.text }}>{e.text}</span>
              </button>
            )
          })}
          {events.length === 0 && (
            <div className="py-8 text-center text-[13px]" style={{ color: C.dim }}>No events recorded.</div>
          )}
        </div>
      </div>
    </div>
  )
}
