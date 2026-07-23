import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AbilityConst,
  HeroStat,
  ItemConst,
  Match,
  MatchPlayer,
  ModifierEvent,
  ParsedKillEvent,
  PositionPoint,
} from 'types'
import { BUILDINGS, buildingDeathTimes, MAP_MAX, MAP_MIN } from '@/lib/buildings'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import { extractObjectiveEvents, type ObjectiveEvent } from './match_objectives'
import { PlayerNameLink } from './match_roster'
import {
  formatClock,
  GameTimeSlider,
  itemsAtTime,
  statsAtTime,
  type TimelineMarker,
  teamScoreAtTime,
} from './match_time'

/* Replay / playback tab, laid out like Stratz's playback page: team panels
   flanking a live minimap (buildings, wards, heroes), a score+clock header,
   and a timeline with event markers.

   OpenDota's parsed data only ever gives two kinds of anchored positions:
   where a hero died in a teamfight (deaths_pos) and where they placed wards
   (obs_log/sen_log), both on the same ~64-192 world grid as the Vision tab
   (NOT 0-127). By default heroes interpolate between those anchors, dimmed
   ("ghost") outside their known range.

   Once our own Go parser (apps/replay-parser) has finished — orchestrated
   and polled automatically by the match page's query, see
   match.$matchId.$tab.tsx — match.players[i].positions carries true
   per-second movement plus live HP/mana/level, and match.kills carries the
   exact kill feed, both merged straight into the match this component
   already receives. No action is required here: dense mode simply takes
   over from sparse/ghost mode the next time this data arrives. */

// Canvas 2D draw calls need real color strings (not classNames), so these two
// stay as raw hex for ctx.fillStyle/strokeStyle call sites specifically.
const CANVAS_COLOR = {
  green: '#9fbf3f',
  red: '#c94a38',
}

const C = {
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
  return match.players.map((_, idx) =>
    [...(deaths[idx] ?? []), ...(wards[idx] ?? [])].sort((a, b) => a.time - b.time),
  )
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
    return {
      x: before.x + (after.x - before.x) * f,
      y: before.y + (after.y - before.y) * f,
      ghost: false,
    }
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

/* Every buff/debuff active on a hero at time t, reconstructed by replaying
   the lifecycle log (see ModifierEvent's doc comment) up to t. Modifiers
   are guaranteed t-ascending (apps/replay-parser sorts them before
   assigning), so this can stop at the first future event instead of
   scanning the whole list every call.

   Three things this deliberately filters, all learned from watching a
   real match: aura=true entries (nearby tower/fountain/etc auras) are
   excluded entirely — they're a passive environmental state, not the
   hero's own buff, and they dominate the list by count since they re-fire
   on a short timer for as long as the hero stays in range. Item-granted
   modifiers (name starting "modifier_item_") are excluded too — a hero's
   items are already shown as icons below, so listing "Item Yasha", "Item
   Radiance" etc. as buffs is redundant, and by late game a heavily-itemed
   hero can have a dozen+ passive item modifiers permanently active,
   dwarfing the actual ability buffs/debuffs the list exists to surface.
   And any entry with a fixed duration expires on its own once that time
   passes, even with no matching removal ever following it — many
   modifiers (again, mostly aura-refresh ones) just stop being re-applied
   rather than sending an explicit removal, so without this they'd show as
   stuck on forever.

   Tracked by name only, not by the Go side's per-slot Index: two
   simultaneous instances of the exact same modifier name (rare — e.g. the
   same debuff from two different casters) would collapse into one entry
   here rather than two, and a removal of either would clear both. Not
   worth the extra field just for that edge case. */
function activeModifiersAt(
  modifiers: ModifierEvent[] | null | undefined,
  t: number,
): { name: string; stacks: number }[] {
  if (!modifiers?.length) return []
  const active = new Map<string, { stacks: number; expiresAt: number | null }>()
  for (const m of modifiers) {
    if (m.t > t) break
    if (m.aura || m.name.startsWith('modifier_item_')) continue
    if (m.active) {
      active.set(m.name, { stacks: m.stacks ?? 1, expiresAt: m.duration ? m.t + m.duration : null })
    } else {
      active.delete(m.name)
    }
  }
  const result: { name: string; stacks: number }[] = []
  for (const [name, v] of active) {
    if (v.expiresAt != null && t >= v.expiresAt) continue
    result.push({ name, stacks: v.stacks })
  }
  return result
}

function humanizeModifierName(raw: string): string {
  return raw
    .replace(/^modifier_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
  kills: ParsedKillEvent[],
  heroByName: Map<string, HeroStat>,
  abilityConst: Record<string, AbilityConst>,
  itemConst: Record<string, ItemConst>,
): ObjectiveEvent[] {
  const teamByHeroId = new Map(
    match.players.map((p) => [
      p.hero_id,
      p.player_slot < 128 ? ('radiant' as const) : ('dire' as const),
    ]),
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
/* Team side panels                                                    */
/* ------------------------------------------------------------------ */

const GoldIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden>
    <title>Gold</title>
    <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">
      $
    </text>
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
  // Without a parse, there's no continuous HP data to know exactly when a
  // dead hero comes back (respawn time depends on level and can be cut
  // short by buyback), so this only tells us "killed recently, might
  // still be dead" from OpenDota's own kill log, same data statsAtTime
  // already uses to count deaths, rather than guessing at a number.
  const heroName = hero?.name ?? ''
  const lastDeathTime =
    !sample && heroName
      ? match.players.reduce((max, pl) => {
          const t = (pl.kills_log ?? [])
            .filter((e) => e.key === heroName && e.time <= timeSec)
            .map((e) => e.time)
          return t.length ? Math.max(max, ...t) : max
        }, -1)
      : -1
  const maybeDead = lastDeathTime >= 0 && timeSec - lastDeathTime <= 100
  const items = itemsAtTime(player, idToName, timeSec, match.duration, itemConst)
  const activeMods = activeModifiersAt(player.modifiers, timeSec)

  const portrait = (
    <div className="relative shrink-0">
      <img
        src={hero ? heroIconUrl(hero.name) : ''}
        alt=""
        style={{ width: 34, height: 34, filter: dead || maybeDead ? 'grayscale(1)' : undefined }}
        onError={(e) => {
          if (!hero) return
          const img = e.currentTarget
          img.onerror = null
          img.src = heroIconFromPath(hero.icon)
        }}
      />
      <span
        className="absolute -bottom-1 -right-1 flex items-center justify-center text-[10px] tabular-nums leading-none text-gold border border-slate-card"
        style={{
          minWidth: 14,
          height: 14,
          background: '#0d1012',
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
      {respawnIn == null && maybeDead && (
        <span
          className="absolute -top-1 -left-1 flex items-center justify-center text-[10px] font-bold leading-none"
          style={{
            minWidth: 14,
            height: 14,
            background: '#3a1210',
            border: '1px solid #6b2622',
            color: '#ff8f7a',
          }}
          title="Killed recently, may still be dead. Exact respawn timer available once parsing finishes."
        >
          ?
        </span>
      )}
    </div>
  )

  return (
    <div
      className="px-2 py-1.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: dead ? 0.55 : 1 }}
    >
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
            <PlayerNameLink player={player} className="text-slate-foreground" />
          </div>
          <div className="flex items-center gap-1.5 text-[13px] tabular-nums leading-tight">
            <span className="text-white">{stats.kills}</span>
            <span style={{ color: '#4a5157' }}>/</span>
            <span className="text-dire">{stats.deaths}</span>
            <span style={{ color: '#4a5157' }}>/</span>
            <span className="text-slate-muted-light">{stats.assists}</span>
            <span className="ml-auto inline-flex items-center gap-0.5 text-gold">
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
              className={`h-full ${dead ? 'bg-slate-border' : 'bg-radiant'}`}
              style={{
                width: `${sample.mhp > 0 ? (sample.hp / sample.mhp) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="h-[3px] w-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div
              className="h-full"
              style={{
                width: `${sample.mmp > 0 ? (sample.mp / sample.mmp) * 100 : 0}%`,
                background: '#4f8fc2',
              }}
            />
          </div>
        </div>
      )}

      {sample && (
        <div
          className="mt-1 grid grid-cols-4 gap-x-1 text-[11px] tabular-nums text-slate-muted-light"
          title="Move speed / attacks per second / damage / armor, live from the parsed replay"
        >
          <span>{sample.speed}</span>
          <span>{sample.atk_time > 0 ? (1 / sample.atk_time).toFixed(2) : '-'}/s</span>
          <span>
            {sample.dmg_min}-{sample.dmg_max}
          </span>
          <span>{sample.armor.toFixed(1)}</span>
        </div>
      )}

      {activeMods.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {activeMods.map((m) => (
            <span
              key={m.name}
              className="px-1 py-0.5 text-[10px] leading-none border border-slate-card text-slate-foreground-light"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              title={m.name}
            >
              {humanizeModifierName(m.name)}
              {m.stacks > 1 && ` x${m.stacks}`}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex gap-0.5">
        {items.map((id, i) => {
          const name = id ? (idToName.get(id) ?? null) : null
          return (
            <ItemIcon
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 6 slots
              key={i}
              name={name}
              meta={name ? itemConst[name] : undefined}
              width={26}
              height={20}
            />
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
        className={`px-3 py-2 text-[13px] uppercase ${side === 'radiant' ? 'text-radiant' : 'text-dire'}`}
        style={{ letterSpacing: '2px', background: C.panelDark }}
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
  const [fogTeam, setFogTeam] = useState<'off' | 'radiant' | 'dire'>('off')

  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const heroByName = useMemo(() => new Map(heroStats.map((h) => [h.name, h])), [heroStats])
  const sparseWaypoints = useMemo(() => buildWaypoints(match), [match])
  // Once our own Go parser has landed, every player carries a `positions`
  // array (see the file-level comment above); until then this stays null
  // and the sparse/ghost fallback below is used instead.
  const denseBySlot = useMemo(() => {
    if (!match.players.some((p) => p.positions != null)) return null
    const map = new Map<number, PositionPoint[]>()
    for (const p of match.players) map.set(p.player_slot, p.positions ?? [])
    return map
  }, [match.players])
  // Positions can start before 0:00 (heroes spawn ~90s before the horn, see
  // apps/replay-parser's pregame handling) — the earliest sample across all
  // players is the actual scrubbable start of the timeline, not 0.
  const minTime = useMemo(() => {
    if (!denseBySlot) return 0
    let min = 0
    for (const pts of denseBySlot.values()) {
      if (pts.length && pts[0].t < min) min = pts[0].t
    }
    return min
  }, [denseBySlot])
  const parsedKills = match.kills ?? null
  const waypointsBySlot = useMemo(() => {
    if (!denseBySlot) return sparseWaypoints
    return match.players.map((p) => {
      const pts = denseBySlot.get(p.player_slot) ?? []
      return pts.map((pt) => ({ time: pt.t, x: pt.x, y: pt.y }))
    })
  }, [denseBySlot, sparseWaypoints, match.players])

  const buildingDeaths = useMemo(() => buildingDeathTimes(match), [match])
  const wardLives = useMemo(() => extractWardLives(match), [match])

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
          color: e.team === 'radiant' ? '#9fbf3f' : e.team === 'dire' ? '#c94a38' : '#f2c94c',
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
        const color = b.team === 'radiant' ? CANVAS_COLOR.green : CANVAS_COLOR.red
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

      if (!denseBySlot) return // sparse/ghost interpolation can't be trusted around deaths - see file header comment
      match.players.forEach((player, idx) => {
        const pos = interpolate(waypointsBySlot[idx] ?? [], t)
        if (!pos) return
        const sample = sampleAt(denseBySlot.get(player.player_slot), t)
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
        ctx.fillStyle = dead ? '#3a4147' : isRadiant ? CANVAS_COLOR.green : CANVAS_COLOR.red
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
          ctx.strokeStyle = CANVAS_COLOR.red
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

  const scoreRadiant = teamScoreAtTime(match, true, time)
  const scoreDire = teamScoreAtTime(match, false, time)

  return (
    <div className="flex flex-wrap gap-3 font-dota">
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
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: C.panelDark }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[26px] leading-none tabular-nums text-radiant">
              {scoreRadiant}
            </span>
            <span
              className="px-2 py-0.5 text-[16px] tabular-nums text-white border border-slate-card"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              {formatClock(time)}
            </span>
            <span className="text-[26px] leading-none tabular-nums text-dire">{scoreDire}</span>
          </div>
          {denseBySlot ? (
            <span className="text-[12px] uppercase text-radiant" style={{ letterSpacing: '1px' }}>
              ✓ Full playback
            </span>
          ) : (
            <span className="text-[12px] text-slate-muted">
              Parsing full playback… check back shortly
            </span>
          )}
        </div>
        <div className="relative flex justify-center px-4">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="w-full max-w-[560px] border border-slate-bg"
          />
          {!denseBySlot && (
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <p
                className="px-4 py-3 text-center text-[13px] text-slate-foreground border border-slate-card"
                style={{ background: 'rgba(8,10,12,0.85)' }}
              >
                Full playback isn't ready yet for this match — still parsing, check back shortly.
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
              if (prev) setTime(Math.max(minTime, prev.time))
            }}
            disabled={!events.some((e) => e.time < time - 0.5)}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-30 text-slate-foreground border border-slate-card"
            style={{ background: '#1a2024' }}
            title="Previous event"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={!denseBySlot}
            title={denseBySlot ? undefined : "Full playback isn't ready yet"}
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-30 text-slate-foreground border border-slate-card"
            style={{ background: '#1a2024' }}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center cursor-pointer hover:brightness-125 disabled:cursor-default disabled:opacity-30 text-slate-foreground border border-slate-card"
            style={{ background: '#1a2024' }}
            title="Next event"
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <div className="flex items-center shrink-0 border border-slate-card">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                disabled={!denseBySlot}
                className={`px-2.5 py-1.5 text-[12px] cursor-pointer disabled:cursor-default disabled:opacity-30 ${speed === s ? 'bg-slate-card text-white' : 'text-slate-muted'}`}
              >
                {s}x
              </button>
            ))}
          </div>
          <div
            className="flex items-center shrink-0 border border-slate-card"
            title={
              denseBySlot
                ? 'Fog of war: show only what this team can see'
                : "Full playback isn't ready yet"
            }
          >
            <span
              className="px-2 text-[11px] uppercase text-slate-muted"
              style={{ letterSpacing: '1px' }}
            >
              Fog
            </span>
            {(['off', 'radiant', 'dire'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFogTeam(f)}
                disabled={!denseBySlot}
                className={`px-2 py-1.5 text-[12px] uppercase cursor-pointer disabled:cursor-default disabled:opacity-30 ${fogTeam === f ? 'bg-slate-card' : ''} ${fogTeam === f ? (f === 'radiant' ? 'text-radiant' : f === 'dire' ? 'text-dire' : 'text-white') : 'text-slate-muted'}`}
              >
                {f === 'off' ? 'Off' : f === 'radiant' ? 'Rad' : 'Dire'}
              </button>
            ))}
          </div>
          <GameTimeSlider
            timeSec={time}
            duration={duration}
            minTime={minTime}
            onChange={(t) => {
              setPlaying(false)
              setTime(t)
            }}
            markers={timelineMarkers}
            fullWidth
          />
        </div>
        {activeTeamfight && (
          <p className="text-center text-[13px] pb-3 text-gold">
            ⚔ Teamfight {formatClock(activeTeamfight.start)}–{formatClock(activeTeamfight.end)} ·{' '}
            {activeTeamfight.deaths} deaths
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
          className="text-[15px] uppercase px-4 py-3 text-white"
          style={{ letterSpacing: '2px', background: C.panelDark }}
        >
          Match Events
        </div>
        <div ref={eventsRef} className="max-h-[600px] overflow-y-auto">
          {events.map((e) => {
            const hero = e.heroId != null ? heroMap.get(e.heroId) : undefined
            const passed = e.time <= time
            return (
              <button
                key={`${e.time}-${e.text}`}
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setTime(Math.max(0, e.time))
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left cursor-pointer hover:bg-white/[0.05]"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  opacity: passed ? 1 : 0.45,
                  background: passed ? 'rgba(242,201,76,0.05)' : 'transparent',
                }}
              >
                <span className="w-11 text-right text-[13px] tabular-nums shrink-0 text-slate-muted">
                  {formatClock(Math.max(0, e.time))}
                </span>
                <span
                  className={
                    e.team === 'radiant'
                      ? 'bg-radiant'
                      : e.team === 'dire'
                        ? 'bg-dire'
                        : 'bg-slate-border'
                  }
                  style={{ width: 3, height: 20 }}
                />
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
                <span className="text-[13px] line-clamp-2 text-slate-foreground">{e.text}</span>
              </button>
            )
          })}
          {events.length === 0 && (
            <div className="py-8 text-center text-[13px] text-slate-muted">No events recorded.</div>
          )}
        </div>
      </div>
    </div>
  )
}
