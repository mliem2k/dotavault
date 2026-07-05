import { Pause, Play, RefreshCw, SkipBack, SkipForward } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import {
  getReplayStatus,
  type ParsedKill,
  type PositionPoint,
  type ReplayJobPhase,
  type ReplayStatus,
  startReplayParse,
} from '@/lib/replay_parser'
import { BUILDINGS, MAP_MAX, MAP_MIN, buildingDeathTimes } from '@/lib/buildings'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { type ObjectiveEvent, extractObjectiveEvents } from './match_objectives'
import { PlayerNameLink } from './match_roster'
import { formatClock, GameTimeSlider, itemsAtTime, statsAtTime, teamScoreAtTime, type TimelineMarker } from './match_time'

/* Replay / playback tab, laid out like Stratz's playback page: team panels
   flanking a live minimap (buildings, wards, heroes), a score+clock header,
   and a timeline with event markers.

   OpenDota's parsed data only ever gives two kinds of anchored positions:
   where a hero died in a teamfight (deaths_pos) and where they placed wards
   (obs_log/sen_log), both on the same ~64-192 world grid as the Vision tab
   (NOT 0-127). By default heroes interpolate between those anchors, dimmed
   ("ghost") outside their known range.

   "Parse Details" upgrades to true per-second movement plus live HP/mana/
   level: previously parsed matches load instantly from our own DB cache on
   mount (no click needed); otherwise our Go service parses Valve's raw
   replay on demand, which only works while Valve still serves the file. */

const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  blue: '#4f8fc2',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

/* ------------------------------------------------------------------ */
/* Wards                                                               */
/* ------------------------------------------------------------------ */

type WardLife = { x: number; y: number; start: number; end: number; team: 'radiant' | 'dire' }

const OBS_LIFETIME = 360

function extractWardLives(match: Match): WardLife[] {
  const wards: WardLife[] = []
  for (const p of match.players) {
    const team = p.player_slot < 128 ? 'radiant' : 'dire'
    const removals = [...(p.obs_left_log ?? [])]
    for (const w of p.obs_log ?? []) {
      const ri = removals.findIndex((r) => r.x === w.x && r.y === w.y && r.time > w.time)
      const end = ri !== -1 ? removals.splice(ri, 1)[0].time : w.time + OBS_LIFETIME
      wards.push({ x: w.x, y: w.y, start: w.time, end, team })
    }
  }
  return wards
}

/* ------------------------------------------------------------------ */
/* Hero position sources                                               */
/* ------------------------------------------------------------------ */

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

/* Nearest dense sample at or before t (samples are 1Hz and time-sorted). */
function sampleAt(points: PositionPoint[] | undefined, t: number): PositionPoint | null {
  if (!points?.length) return null
  let lo = 0
  let hi = points.length - 1
  if (t < points[0].t) return points[0]
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (points[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return points[lo]
}

/* Seconds remaining until this hero's next respawn, or null if not
   currently dead. Scans forward from the current 1Hz sample to the first
   later sample with hp > 0 (respawn), rather than computing Dota's
   level/time respawn formula, since the parsed position data already
   captures the real moment they come back. */
function respawnCountdown(points: PositionPoint[] | undefined, t: number): number | null {
  if (!points?.length) return null
  let lo = 0
  let hi = points.length - 1
  if (t < points[0].t) return null
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (points[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  if (points[lo].hp > 0) return null
  for (let i = lo + 1; i < points.length; i++) {
    if (points[i].hp > 0) return Math.max(0, Math.round(points[i].t - t))
  }
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

/* Kill events from our own replay parse: same shape as the OpenDota-based
   feed but with the killing blow and the victim's death gold loss. */
function parsedKillEvents(
  match: Match,
  kills: ParsedKill[],
  heroByName: Map<string, HeroStat>,
  abilityConst: Record<string, AbilityConst>,
  itemConst: Record<string, ItemConst>,
): ObjectiveEvent[] {
  const teamByHeroId = new Map(
    match.players.map((p) => [p.hero_id, p.player_slot < 128 ? ('radiant' as const) : ('dire' as const)]),
  )
  const humanize = (raw: string): string => {
    if (raw.startsWith('item_')) {
      const item = itemConst[raw.slice(5)]
      if (item?.dname) return item.dname
    }
    const ab = abilityConst[raw]
    if (ab?.dname) return ab.dname
    return raw
      .replace(/^item_/, '')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  const displayName = (npc: string): string =>
    heroByName.get(npc)?.localized_name ?? npc.replace('npc_dota_hero_', '').replace(/_/g, ' ')

  return kills.map((k) => {
    const killer = heroByName.get(k.attacker)
    let text = `${displayName(k.attacker)} killed ${displayName(k.victim)}`
    if (k.inflictor) text += ` with ${humanize(k.inflictor)}`
    if (k.gold) text += ` (lost ${k.gold}g)`
    return {
      time: k.t,
      icon: '⚔',
      text,
      team: killer ? (teamByHeroId.get(killer.id) ?? null) : null,
      heroId: killer?.id,
    }
  })
}

function toCanvas(val: number, size: number): number {
  return ((val - MAP_MIN) / (MAP_MAX - MAP_MIN)) * size
}

/* ------------------------------------------------------------------ */
/* Parse request (unparsed matches)                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Team side panels                                                    */
/* ------------------------------------------------------------------ */

const GoldIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden>
    <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">$</text>
  </svg>
)

function PlayerRow({
  player,
  hero,
  match,
  timeSec,
  idToName,
  itemConst,
  dense,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  match: Match
  timeSec: number
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  dense: PositionPoint[] | undefined
}) {
  const stats = statsAtTime(player, match.players, hero?.name ?? '', timeSec, match.duration)
  const sample = sampleAt(dense, timeSec)
  const level = sample?.lvl || stats.level
  const dead = sample != null && sample.hp === 0
  const respawnIn = dead ? respawnCountdown(dense, timeSec) : null
  const items = itemsAtTime(player, idToName, timeSec, match.duration, itemConst)

  const portrait = (
    <div className="relative shrink-0">
      <img
        src={hero ? heroIconUrl(hero.name) : ''}
        alt=""
        style={{ width: 34, height: 34, filter: dead ? 'grayscale(1)' : undefined }}
        onError={(e) => {
          if (!hero) return
          const img = e.currentTarget
          img.onerror = null
          img.src = heroIconFromPath(hero.icon)
        }}
      />
      <span
        className="absolute -bottom-1 -right-1 flex items-center justify-center text-[10px] tabular-nums leading-none"
        style={{
          minWidth: 14,
          height: 14,
          background: '#0d1012',
          border: '1px solid #2c3236',
          color: C.gold,
        }}
        title="Level"
      >
        {level}
      </span>
      {respawnIn != null && (
        <span
          className="absolute -top-1 -left-1 flex items-center justify-center text-[10px] font-bold tabular-nums leading-none"
          style={{
            minWidth: 14,
            height: 14,
            background: '#3a1210',
            border: '1px solid #6b2622',
            color: '#ff8f7a',
          }}
          title="Respawns in"
        >
          {respawnIn}
        </span>
      )}
    </div>
  )

  return (
    <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: dead ? 0.55 : 1 }}>
      <div className="flex items-center gap-1.5">
        {player.account_id ? (
          <a href={`/player/${player.account_id}`} className="shrink-0 hover:brightness-125">
            {portrait}
          </a>
        ) : (
          portrait
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-tight">
            <PlayerNameLink player={player} style={{ color: C.text }} />
          </div>
          <div className="flex items-center gap-1.5 text-[13px] tabular-nums leading-tight">
            <span style={{ color: C.white }}>{stats.kills}</span>
            <span style={{ color: '#4a5157' }}>/</span>
            <span style={{ color: C.red }}>{stats.deaths}</span>
            <span style={{ color: '#4a5157' }}>/</span>
            <span style={{ color: C.label }}>{stats.assists}</span>
            <span className="ml-auto inline-flex items-center gap-0.5" style={{ color: C.gold }}>
              <GoldIcon size={10} />
              {stats.netWorth >= 1000 ? `${(stats.netWorth / 1000).toFixed(1)}k` : stats.netWorth}
            </span>
          </div>
        </div>
      </div>

      {sample && (
        <div className="mt-1 space-y-0.5">
          <div className="h-[4px] w-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div
              className="h-full"
              style={{
                width: `${sample.mhp > 0 ? (sample.hp / sample.mhp) * 100 : 0}%`,
                background: dead ? '#3a4147' : C.green,
              }}
            />
          </div>
          <div className="h-[3px] w-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div
              className="h-full"
              style={{ width: `${sample.mmp > 0 ? (sample.mp / sample.mmp) * 100 : 0}%`, background: C.blue }}
            />
          </div>
        </div>
      )}

      <div className="mt-1 flex gap-0.5">
        {items.map((id, i) => {
          const name = id ? (idToName.get(id) ?? null) : null
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 6 slots
              key={i}
              className="overflow-hidden"
              style={{ width: 26, height: 20, background: '#0d1012', border: '1px solid #22282c' }}
            >
              {name && (
                <img
                  src={`/items/${name}.webp`}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget
                    if (!img.src.includes('cdn.cloudflare')) {
                      img.src = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${name}.png`
                    } else {
                      img.onerror = null
                      img.style.opacity = '0.12'
                    }
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TeamPanel({
  side,
  players,
  heroMap,
  match,
  timeSec,
  idToName,
  itemConst,
  denseBySlot,
}: {
  side: 'radiant' | 'dire'
  players: MatchPlayer[]
  heroMap: Map<number, HeroStat>
  match: Match
  timeSec: number
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  denseBySlot: Map<number, PositionPoint[]> | null
}) {
  return (
    <div className="w-[240px] shrink-0 self-start" style={{ background: C.panel }}>
      <div
        className="px-3 py-2 text-[13px] uppercase"
        style={{ color: side === 'radiant' ? C.green : C.red, letterSpacing: '2px', background: C.panelDark }}
      >
        {side === 'radiant' ? 'Radiant' : 'Dire'}
      </div>
      {players.map((p) => (
        <PlayerRow
          key={p.player_slot}
          player={p}
          hero={heroMap.get(p.hero_id)}
          match={match}
          timeSec={timeSec}
          idToName={idToName}
          itemConst={itemConst}
          dense={denseBySlot?.get(p.player_slot)}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main viewer                                                         */
/* ------------------------------------------------------------------ */

const SPEEDS = [1, 2, 4, 8]

export function ReplayViewer({
  match,
  heroStats,
  idToName,
  itemConst,
  abilityConst,
  initialTime,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  abilityConst: Record<string, AbilityConst>
  // Seconds to open the timeline at, e.g. jumping in from a teamfight or
  // kill in another tab. Only honored once on mount: switching to another
  // tab and back shouldn't keep re-seeking to the same old moment.
  initialTime?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapImgRef = useRef<HTMLImageElement | null>(null)
  const iconImgsRef = useRef<Map<number, HTMLImageElement>>(new Map())
  const animRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const [time, setTime] = useState(() => initialTime ?? 0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullPlaybackState, setFullPlaybackState] = useState<'idle' | 'working' | 'unavailable' | 'error' | 'done'>('idle')
  const [workPhase, setWorkPhase] = useState<ReplayJobPhase | null>(null)
  const [denseBySlot, setDenseBySlot] = useState<Map<number, PositionPoint[]> | null>(null)
  const [parsedKills, setParsedKills] = useState<ParsedKill[] | null>(null)
  const [fogTeam, setFogTeam] = useState<'off' | 'radiant' | 'dire'>('off')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const heroByName = useMemo(() => new Map(heroStats.map((h) => [h.name, h])), [heroStats])
  const sparseWaypoints = useMemo(() => buildWaypoints(match), [match])
  const waypointsBySlot = useMemo(() => {
    if (!denseBySlot) return sparseWaypoints
    return match.players.map((p) => {
      const pts = denseBySlot.get(p.player_slot) ?? []
      return pts.map((pt) => ({ time: pt.t, x: pt.x, y: pt.y }))
    })
  }, [denseBySlot, sparseWaypoints, match.players])
  const hasAnyWaypoints = waypointsBySlot.some((w) => w.length > 0)
  // The API can orchestrate the OpenDota parse itself when the salt isn't
  // known yet, so full playback is offerable for any match.
  const canFetchFullPlayback = true

  const buildingDeaths = useMemo(() => buildingDeathTimes(match), [match])
  const wardLives = useMemo(() => extractWardLives(match), [match])

  function adoptResult(result: { positions: Record<string, PositionPoint[]>; kills?: ParsedKill[] }) {
    const map = new Map<number, PositionPoint[]>()
    for (const [slot, pts] of Object.entries(result.positions)) map.set(Number(slot), pts)
    setDenseBySlot(map)
    if (result.kills?.length) setParsedKills(result.kills)
    setFullPlaybackState('done')
  }

  function applyStatus(status: ReplayStatus): boolean {
    switch (status.kind) {
      case 'done':
        if (pollRef.current) clearInterval(pollRef.current)
        adoptResult(status.result)
        return true
      case 'failed':
        if (pollRef.current) clearInterval(pollRef.current)
        setWorkPhase(null)
        setFullPlaybackState(status.phase === 'gone' ? 'unavailable' : 'error')
        return true
      case 'working':
        setWorkPhase(status.phase)
        setFullPlaybackState('working')
        return false
      default:
        return false
    }
  }

  // The polling doubles as a keep-alive for the scale-to-zero API machine.
  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await getReplayStatus(match.match_id)
        if (s.kind !== 'none') applyStatus(s)
      } catch {}
    }, 6000)
  }

  // Opening the tab checks for a result or job already in progress (e.g. a
  // previous parse, or one started from another tab) and adopts/resumes it
  // without waiting for a "Full Playback" click.
  useEffect(() => {
    let cancelled = false
    getReplayStatus(match.match_id).then((status) => {
      if (cancelled) return
      if (applyStatus(status)) return
      if (status.kind === 'working') startPolling()
    })
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [match.match_id])

  // One click starts the server-side job (which requests an OpenDota parse
  // first when the replay salt isn't known yet); after that we just poll.
  async function fetchFullPlayback() {
    setFullPlaybackState('working')
    setWorkPhase(match.replay_salt != null ? 'parsing' : 'requesting_parse')
    try {
      const status = await startReplayParse(match.match_id, match.cluster, match.replay_salt)
      if (applyStatus(status)) return
      startPolling()
    } catch {
      setFullPlaybackState('error')
    }
  }

  const events = useMemo(() => {
    const kills = parsedKills?.length
      ? parsedKillEvents(match, parsedKills, heroByName, abilityConst, itemConst)
      : extractKillEvents(match, heroMap, heroByName)
    const combined = [...extractObjectiveEvents(match, heroStats), ...kills]
    combined.sort((a, b) => a.time - b.time)
    return combined
  }, [match, heroStats, heroMap, heroByName, parsedKills, abilityConst, itemConst])

  const timelineMarkers = useMemo<TimelineMarker[]>(
    () =>
      events
        .filter((e) => e.time > 0)
        .map((e) => ({
          time: e.time,
          color: e.team === 'radiant' ? C.green : e.team === 'dire' ? C.red : C.gold,
        })),
    [events],
  )

  const duration = match.duration
  const activeTeamfight = match.teamfights?.find((tf) => time >= tf.start && time <= tf.end)

  // Keep the event feed following the playhead (last passed event visible).
  const eventsRef = useRef<HTMLDivElement>(null)
  const lastPassedIdx = useMemo(() => {
    let idx = -1
    for (let i = 0; i < events.length; i++) if (events[i].time <= time) idx = i
    return idx
  }, [events, time])
  useEffect(() => {
    const container = eventsRef.current
    if (!container || lastPassedIdx < 0) return
    const el = container.children[lastPassedIdx] as HTMLElement | undefined
    if (!el) return
    const top = el.offsetTop - container.clientHeight / 2
    container.scrollTo({ top: Math.max(0, top) })
  }, [lastPassedIdx])
  const radiant = useMemo(() => match.players.filter((p) => p.player_slot < 128), [match.players])
  const dire = useMemo(() => match.players.filter((p) => p.player_slot >= 128), [match.players])

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

      // Buildings (behind wards and heroes). Destroyed ones vanish.
      BUILDINGS.forEach((b, i) => {
        if (t >= buildingDeaths[i]) return
        const cx = toCanvas(b.x, size)
        const cy = size - toCanvas(b.y, size)
        const color = b.team === 'radiant' ? C.green : C.red
        ctx.save()
        if (b.kind === 'fort') {
          ctx.beginPath()
          ctx.arc(cx, cy, 7, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = '#0d1012'
          ctx.stroke()
        } else if (b.kind === 'tower') {
          ctx.fillStyle = color
          ctx.strokeStyle = '#0d1012'
          ctx.lineWidth = 1
          ctx.fillRect(cx - 3.5, cy - 3.5, 7, 7)
          ctx.strokeRect(cx - 3.5, cy - 3.5, 7, 7)
        } else {
          ctx.translate(cx, cy)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = color
          ctx.fillRect(-2.5, -2.5, 5, 5)
        }
        ctx.restore()
      })

      /* Fog of war, same emulation as the Vision tab: darken the map, then
         punch out the fog team's vision sources (living observer wards,
         alive heroes, standing buildings). Radii are Dota's day-vision
         ranges scaled onto the 16384-unit map. */
      const reveals: { x: number; y: number; r: number }[] = []
      if (fogTeam !== 'off') {
        const WARD_R = size * (1600 / 16384)
        const HERO_R = size * (1800 / 16384)
        const TOWER_R = size * (1900 / 16384)
        const BUILDING_R = size * (900 / 16384)

        for (const w of wardLives) {
          if (w.team !== fogTeam || t < w.start || t > w.end) continue
          reveals.push({ x: toCanvas(w.x, size), y: size - toCanvas(w.y, size), r: WARD_R })
        }
        BUILDINGS.forEach((b, i) => {
          if (b.team !== fogTeam || t >= buildingDeaths[i]) return
          reveals.push({
            x: toCanvas(b.x, size),
            y: size - toCanvas(b.y, size),
            r: b.kind === 'tower' ? TOWER_R : BUILDING_R,
          })
        })
        match.players.forEach((player, idx) => {
          const team = player.player_slot < 128 ? 'radiant' : 'dire'
          if (team !== fogTeam) return
          const pos = interpolate(waypointsBySlot[idx] ?? [], t)
          if (!pos) return
          const sample = denseBySlot ? sampleAt(denseBySlot.get(player.player_slot), t) : null
          if (sample != null && sample.hp === 0) return // dead heroes see nothing
          reveals.push({ x: toCanvas(pos.x, size), y: size - toCanvas(pos.y, size), r: HERO_R })
        })

        const fog = document.createElement('canvas')
        fog.width = size
        fog.height = size
        const fctx = fog.getContext('2d')
        if (fctx) {
          fctx.fillStyle = 'rgba(4,8,12,0.82)'
          fctx.fillRect(0, 0, size, size)
          fctx.globalCompositeOperation = 'destination-out'
          for (const rv of reveals) {
            const g = fctx.createRadialGradient(rv.x, rv.y, rv.r * 0.55, rv.x, rv.y, rv.r)
            g.addColorStop(0, 'rgba(0,0,0,1)')
            g.addColorStop(1, 'rgba(0,0,0,0)')
            fctx.fillStyle = g
            fctx.beginPath()
            fctx.arc(rv.x, rv.y, rv.r, 0, Math.PI * 2)
            fctx.fill()
          }
          ctx.drawImage(fog, 0, 0)
        }
      }
      const inVision = (cx: number, cy: number) =>
        reveals.some((rv) => (cx - rv.x) ** 2 + (cy - rv.y) ** 2 <= rv.r * rv.r)

      // Live observer wards. Under fog, enemy wards are hidden (sentry
      // true-sight isn't simulated here).
      for (const w of wardLives) {
        if (t < w.start || t > w.end) continue
        if (fogTeam !== 'off' && w.team !== fogTeam) continue
        const cx = toCanvas(w.x, size)
        const cy = size - toCanvas(w.y, size)
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(242,201,76,0.9)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cy, 1.6, 0, Math.PI * 2)
        ctx.fillStyle = w.team === 'radiant' ? '#2c3f10' : '#43140d'
        ctx.fill()
        ctx.restore()
      }

      match.players.forEach((player, idx) => {
        const pos = interpolate(waypointsBySlot[idx] ?? [], t)
        if (!pos) return
        const sample = denseBySlot ? sampleAt(denseBySlot.get(player.player_slot), t) : null
        const dead = sample != null && sample.hp === 0
        const cx = toCanvas(pos.x, size)
        const cy = size - toCanvas(pos.y, size)
        const isRadiant = player.player_slot < 128
        // Under fog, enemy heroes only appear inside the revealed area.
        const team = isRadiant ? 'radiant' : 'dire'
        if (fogTeam !== 'off' && team !== fogTeam && !inVision(cx, cy)) return
        const icon = iconImgsRef.current.get(player.hero_id)
        const r = 13
        const alpha = pos.ghost ? 0.4 : dead ? 0.55 : 1

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
        ctx.fillStyle = dead ? '#3a4147' : isRadiant ? C.green : C.red
        ctx.fill()

        if (icon?.complete && icon.naturalWidth > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.clip()
          if (dead) ctx.filter = 'grayscale(1)'
          ctx.drawImage(icon, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()
        }
        if (dead) {
          ctx.strokeStyle = C.red
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(cx - 6, cy - 6)
          ctx.lineTo(cx + 6, cy + 6)
          ctx.moveTo(cx + 6, cy - 6)
          ctx.lineTo(cx - 6, cy + 6)
          ctx.stroke()
        }
        ctx.restore()
      })
    },
    [match, waypointsBySlot, activeTeamfight, buildingDeaths, wardLives, denseBySlot, fogTeam],
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

  // Our own parser works independently of OpenDota's parse, so the playback
  // UI stays available whenever position data exists OR could still be
  // fetched from Valve's CDN. Only give up when neither is true.
  if (!hasAnyWaypoints && !denseBySlot && !canFetchFullPlayback) {
    if (match.version === null) return <ParseRequest matchId={match.match_id} />
    return (
      <div className="p-8 text-center" style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
        <p className="text-[14px]" style={{ color: C.dim }}>
          No teamfight or ward position data available for this match.
        </p>
      </div>
    )
  }

  const scoreRadiant = teamScoreAtTime(match, true, time)
  const scoreDire = teamScoreAtTime(match, false, time)

  return (
    <div className="flex flex-wrap gap-3" style={{ fontFamily: 'var(--font-dota)' }}>
      <TeamPanel
        side="radiant"
        players={radiant}
        heroMap={heroMap}
        match={match}
        timeSec={time}
        idToName={idToName}
        itemConst={itemConst}
        denseBySlot={denseBySlot}
      />

      {/* Map + controls */}
      <div className="min-w-[420px] flex-1 space-y-3" style={{ background: C.panel }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ background: C.panelDark }}>
          <div className="flex items-center gap-3">
            <span className="text-[26px] leading-none tabular-nums" style={{ color: C.green }}>{scoreRadiant}</span>
            <span
              className="px-2 py-0.5 text-[16px] tabular-nums"
              style={{ color: C.white, background: 'rgba(0,0,0,0.5)', border: '1px solid #2c3236' }}
            >
              {formatClock(time)}
            </span>
            <span className="text-[26px] leading-none tabular-nums" style={{ color: C.red }}>{scoreDire}</span>
          </div>
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
                disabled={fullPlaybackState === 'working'}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-60"
                style={{ background: '#1d2a12', border: '1px solid #3d5a24', color: C.green, letterSpacing: '1px' }}
                title="Parses the raw replay ourselves for true continuous hero movement plus live HP/mana/levels. If OpenDota hasn't parsed the match yet, the server requests that first and continues automatically; only works while Valve still serves the replay file"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fullPlaybackState === 'working' ? 'animate-spin' : ''}`} />
                {fullPlaybackState === 'working'
                  ? workPhase === 'requesting_parse'
                    ? 'Requesting OpenDota Parse…'
                    : workPhase === 'waiting_salt'
                      ? 'Waiting For Replay Info…'
                      : 'Parsing Replay…'
                  : fullPlaybackState === 'error'
                    ? 'Retry Parse Details'
                    : 'Parse Details'}
              </button>
            </div>
          )}
          {fullPlaybackState === 'done' && (
            <span className="text-[12px] uppercase" style={{ color: C.green, letterSpacing: '1px' }}>
              ✓ Full playback
            </span>
          )}
        </div>
        <div className="relative flex justify-center px-4">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="w-full max-w-[560px]"
            style={{ border: '1px solid #22282c' }}
          />
          {!hasAnyWaypoints && !denseBySlot && (
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <p
                className="px-4 py-3 text-center text-[13px]"
                style={{ color: C.text, background: 'rgba(8,10,12,0.85)', border: '1px solid #2c3236' }}
              >
                No position data from OpenDota for this match.
                {fullPlaybackState === 'working'
                  ? ' Working on it, this can take a few minutes for unparsed matches…'
                  : ' Use Parse Details above to parse the replay directly.'}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              const prev = [...events].reverse().find((e) => e.time < time - 0.5)
              if (prev) setTime(Math.max(0, prev.time))
            }}
            disabled={!events.some((e) => e.time < time - 0.5)}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-30"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: C.text }}
            title="Previous event"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: C.text }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              const next = events.find((e) => e.time > time + 0.5)
              if (next) setTime(Math.min(duration, next.time))
            }}
            disabled={!events.some((e) => e.time > time + 0.5)}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-30"
            style={{ background: '#1a2024', border: '1px solid #2c3236', color: C.text }}
            title="Next event"
          >
            <SkipForward className="h-4 w-4" />
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
          <div className="flex items-center shrink-0" style={{ border: '1px solid #2c3236' }} title="Fog of war: show only what this team can see">
            <span className="px-2 text-[11px] uppercase" style={{ color: C.dim, letterSpacing: '1px' }}>Fog</span>
            {(['off', 'radiant', 'dire'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFogTeam(f)}
                className="px-2 py-1.5 text-[12px] uppercase cursor-pointer"
                style={{
                  background: fogTeam === f ? '#2c3236' : 'transparent',
                  color: fogTeam === f ? (f === 'radiant' ? C.green : f === 'dire' ? C.red : C.white) : C.dim,
                }}
              >
                {f === 'off' ? 'Off' : f === 'radiant' ? 'Rad' : 'Dire'}
              </button>
            ))}
          </div>
          <GameTimeSlider
            timeSec={time}
            duration={duration}
            onChange={(t) => { setPlaying(false); setTime(t) }}
            markers={timelineMarkers}
            fullWidth
          />
        </div>
        {activeTeamfight && (
          <p className="text-center text-[13px] pb-3" style={{ color: C.gold }}>
            ⚔ Teamfight {formatClock(activeTeamfight.start)}–{formatClock(activeTeamfight.end)} · {activeTeamfight.deaths} deaths
          </p>
        )}
      </div>

      <TeamPanel
        side="dire"
        players={dire}
        heroMap={heroMap}
        match={match}
        timeSec={time}
        idToName={idToName}
        itemConst={itemConst}
        denseBySlot={denseBySlot}
      />

      {/* Synced event feed */}
      <div className="w-[300px] shrink-0" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}
        >
          Match Events
        </div>
        <div ref={eventsRef} className="max-h-[600px] overflow-y-auto">
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
                <span className="text-[13px] line-clamp-2" style={{ color: C.text }}>{e.text}</span>
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
