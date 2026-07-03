import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { HeroBenchmarks, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import { cdnFallback, heroIconFromPath, heroIconUrl, heroVertCdn, heroVertUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import { levelFromXp } from './match_roster'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

// Animated hero renders (kept on Valve's CDN — the webm clips are ~1.3MB each).
const RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders'

// Animated hero render, falling back to the self-hosted static portrait if the
// clip is unavailable.
function HeroRender({
  hero,
  className,
  objectPosition = 'center top',
}: {
  hero: HeroStat
  className?: string
  objectPosition?: string
}) {
  const [failed, setFailed] = useState(false)
  const playedRef = useRef(false)
  const shortName = hero.name.replace('npc_dota_hero_', '')

  // Fall back to the static portrait if the clip isn't playable in time.
  useEffect(() => {
    if (failed) return
    const t = setTimeout(() => {
      if (!playedRef.current) setFailed(true)
    }, 2500)
    return () => clearTimeout(t)
  }, [failed])

  if (failed) {
    return (
      <img
        src={heroVertUrl(hero.name)}
        alt={hero.localized_name}
        className={className}
        style={{ objectPosition }}
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.fb !== '1') { img.dataset.fb = '1'; img.src = heroVertCdn(hero.name) }
          else { img.onerror = null; img.src = heroIconFromPath(hero.icon) }
        }}
      />
    )
  }
  return (
    <video
      key={shortName}
      autoPlay
      loop
      muted
      playsInline
      poster={`${RENDER}/${shortName}.png`}
      className={className}
      style={{ objectPosition }}
      onCanPlay={() => { playedRef.current = true }}
      onError={() => setFailed(true)}
    >
      <source type="video/webm" src={`${RENDER}/${shortName}.webm`} />
      <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${shortName}.mov`} />
    </video>
  )
}

function fmtK(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function formatClock(seconds: number): string {
  const neg = seconds < 0
  const abs = Math.abs(Math.floor(seconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

const GoldIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" className="inline-block shrink-0">
    <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">$</text>
  </svg>
)

/* ------------------------------------------------------------------ */
/* Data derivations                                                    */
/* ------------------------------------------------------------------ */

// Final inventory items, revealed only once purchased at/before `timeSec`.
function itemsAtTime(player: MatchPlayer, idToName: Map<number, string>, timeSec: number): number[] {
  const finalItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const log = player.purchase_log ?? []
  const firstTime = new Map<string, number>()
  for (const e of log) {
    if (!firstTime.has(e.key)) firstTime.set(e.key, e.time)
  }
  return finalItems.map((id) => {
    if (!id) return 0
    const name = idToName.get(id)
    if (!name) return id // no timing info (unparsed) → always show
    const t = firstTime.get(name)
    if (t == null) return id
    return t <= timeSec ? id : 0
  })
}

type TimedStats = {
  netWorth: number
  kills: number
  deaths: number
  assists: number
  lastHits: number
  level: number
  gpm: number
  xpm: number
}

// Reconstruct a player's stats at slider time `timeSec` from the parsed time
// series (gold_t/xp_t/lh_t) and kill logs. At the end of the game (default
// slider position) this returns the final scoreboard values exactly.
function statsAtTime(
  player: MatchPlayer,
  allPlayers: MatchPlayer[],
  heroName: string,
  timeSec: number,
  durationSec: number,
): TimedStats {
  const atEnd = timeSec >= durationSec
  const goldT = player.gold_t
  const xpT = player.xp_t
  const lhT = player.lh_t
  const idx = Math.max(0, Math.floor(timeSec / 60))

  const at = (arr: number[] | null, fallback: number): number => {
    if (atEnd || !arr || arr.length === 0) return fallback
    return arr[Math.min(idx, arr.length - 1)] ?? fallback
  }

  const netWorth = at(goldT, player.net_worth)
  const lastHits = at(lhT, player.last_hits)
  const xpVal = xpT && xpT.length ? (xpT[Math.min(idx, xpT.length - 1)] ?? 0) : 0
  const level = atEnd || !xpT?.length ? player.level : levelFromXp(xpVal)
  const minutesElapsed = Math.max(1, timeSec / 60)
  const gpm = atEnd ? player.gold_per_min : Math.round(netWorth / minutesElapsed)
  const xpm = atEnd || !xpT?.length ? player.xp_per_min : Math.round(xpVal / minutesElapsed)
  const kills = atEnd
    ? player.kills
    : (player.kills_log ?? []).filter((e) => e.time <= timeSec).length
  const deaths = atEnd
    ? player.deaths
    : allPlayers.reduce(
        (s, pl) => s + (pl.kills_log ?? []).filter((e) => e.key === heroName && e.time <= timeSec).length,
        0,
      )
  // Assists have no per-time series in the OpenDota response → final value only.
  const assists = player.assists

  return { netWorth, kills, deaths, assists, lastHits, level, gpm, xpm }
}

type PlayStyle = { support: number; pushing: number; fighting: number; farming: number }

// Relative play style within THIS match (top performer per axis ≈ 10).
function playStyle(player: MatchPlayer, all: MatchPlayer[]): PlayStyle {
  const maxOf = (f: (p: MatchPlayer) => number) => Math.max(1, ...all.map(f))
  const supportRaw = (p: MatchPlayer) => p.hero_healing + (p.obs_placed ?? 0) * 200 + (p.sen_placed ?? 0) * 120
  const fightRaw = (p: MatchPlayer) => p.kills + p.assists + p.hero_damage / 1000
  const scale = (v: number) => Math.min(10, Math.max(0, v * 10))
  return {
    support: scale(supportRaw(player) / maxOf(supportRaw)),
    pushing: scale(player.tower_damage / maxOf((p) => p.tower_damage)),
    fighting: scale(fightRaw(player) / maxOf(fightRaw)),
    farming: scale(player.last_hits / maxOf((p) => p.last_hits)),
  }
}

function benchmarkMedian(hb: HeroBenchmarks | undefined, key: string): number | null {
  const arr = hb?.result?.[key]
  if (!arr?.length) return null
  const mid = arr.find((x) => x.percentile === 0.5) ?? arr[Math.floor(arr.length / 2)]
  return mid?.value ?? null
}

// Mean of available benchmark percentiles → overall standing (0..1).
function overallPercentile(player: MatchPlayer): number {
  const b = player.benchmarks
  if (!b) return 0.5
  const keys = ['gold_per_min', 'xp_per_min', 'last_hits_per_min', 'hero_damage_per_min'] as const
  const vals = keys.map((k) => b[k]?.pct).filter((v): v is number => typeof v === 'number')
  if (!vals.length) return 0.5
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/* ------------------------------------------------------------------ */
/* Portrait card (team view)                                           */
/* ------------------------------------------------------------------ */

function HeroPortraitCard({
  player,
  hero,
  isRadiant,
  onClick,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  isRadiant: boolean
  onClick: () => void
}) {
  const teamColor = isRadiant ? '#8ec63f' : '#d14a38'
  const slotColor = PLAYER_COLORS[player.player_slot] ?? '#888'
  const playerName = player.personaname ?? player.name ?? 'Anonymous'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden shrink-0 flex flex-col text-left cursor-pointer"
      style={{ width: '118px', height: '300px', background: '#100e0b' }}
    >
      <div className="absolute top-0 left-0 right-0 z-20 h-[3px]" style={{ background: teamColor }} />
      <div className="absolute top-[3px] left-0 bottom-0 z-20 w-[2px]" style={{ background: slotColor }} />

      {hero ? (
        <HeroRender
          hero={hero}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          objectPosition="center top"
        />
      ) : (
        <div className="absolute inset-0 bg-[#161310]" />
      )}

      <div
        className="absolute inset-0 z-10"
        style={{ background: 'linear-gradient(180deg, rgba(4,10,18,0.85) 0%, transparent 22%, transparent 55%, rgba(4,10,18,0.9) 100%)' }}
      />

      {/* Player name */}
      <div className="absolute top-1.5 left-1.5 right-1.5 z-20">
        <span
          className="block text-[12px] font-semibold leading-tight line-clamp-2 group-hover:text-white"
          style={{ color: '#e8e2d4', fontFamily: 'var(--font-dota)', letterSpacing: '0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {playerName}
        </span>
      </div>

      {/* Net worth + KDA */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-1.5 pb-1.5">
        <div className="flex items-center gap-1 mb-0.5">
          <GoldIcon size={11} />
          <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color: '#d8bf6a', fontFamily: 'var(--font-dota)' }}>
            {player.net_worth.toLocaleString()}
          </span>
        </div>
        <div className="text-[13px] font-bold tabular-nums leading-none" style={{ fontFamily: 'var(--font-dota)' }}>
          <span style={{ color: '#57c262' }}>{player.kills}</span>
          <span style={{ color: '#5a5446' }}> / </span>
          <span style={{ color: '#e84747' }}>{player.deaths}</span>
          <span style={{ color: '#5a5446' }}> / </span>
          <span style={{ color: '#dcd6c8' }}>{player.assists}</span>
        </div>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Thumbnail strip (collapsed team)                                    */
/* ------------------------------------------------------------------ */

function ThumbStrip({
  players,
  heroMap,
  selectedSlot,
  onSelect,
}: {
  players: MatchPlayer[]
  heroMap: Map<number, HeroStat>
  selectedSlot: number
  onSelect: (slot: number) => void
}) {
  return (
    <div className="flex gap-1.5">
      {players.map((p) => {
        const hero = heroMap.get(p.hero_id)
        const active = p.player_slot === selectedSlot
        return (
          <button
            key={p.player_slot}
            type="button"
            onClick={() => onSelect(p.player_slot)}
            className="relative shrink-0 overflow-hidden rounded transition-all"
            style={{
              width: 52,
              height: 52,
              border: active ? '2px solid #c9a94a' : '2px solid transparent',
              opacity: active ? 1 : 0.55,
              filter: active ? 'none' : 'grayscale(0.3)',
            }}
            title={p.personaname ?? p.name ?? ''}
          >
            {hero && (
              <img
                src={heroIconUrl(hero.name)}
                alt={hero.localized_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget
            img.onerror = null
            img.src = heroIconFromPath(hero.icon)
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Play style bars                                                     */
/* ------------------------------------------------------------------ */

function PlayStyleBars({ style }: { style: PlayStyle }) {
  const rows: [string, number][] = [
    ['Support', style.support],
    ['Pushing', style.pushing],
    ['Fighting', style.fighting],
    ['Farming', style.farming],
  ]
  return (
    <div>
      <div
        className="text-center text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: '#948e7c', fontFamily: 'var(--font-dota)' }}
      >
        Play Style in This Match
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-right"
              style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
            >
              {label}
            </span>
            <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: '#161310' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(val / 10) * 100}%`,
                  background: 'linear-gradient(90deg, #4a7a2a, #8ec63f)',
                }}
              />
            </div>
            <span className="w-7 shrink-0 text-[11px] tabular-nums" style={{ color: '#9ab84a', fontFamily: 'var(--font-dota)' }}>
              {val.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* vs averages box                                                     */
/* ------------------------------------------------------------------ */

function DeltaValue({ value, delta }: { value: number; delta: number | null }) {
  const color = delta == null ? '#dcd6c8' : delta >= 0 ? '#7ac74f' : '#e07a5a'
  return (
    <span className="text-[13px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-dota)' }}>
      {value.toLocaleString()}
      {delta != null && (
        <span className="text-[11px] ml-1 opacity-90">
          ({delta >= 0 ? '+' : ''}{delta})
        </span>
      )}
    </span>
  )
}

function VsAveragesBox({
  player,
  hero,
  stats,
  heroBenchmarks,
  elapsedMin,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  stats: TimedStats
  heroBenchmarks: HeroBenchmarks | undefined
  elapsedMin: number
}) {
  const gpmAvg = benchmarkMedian(heroBenchmarks, 'gold_per_min')
  const xpmAvg = benchmarkMedian(heroBenchmarks, 'xp_per_min')
  const kpmAvg = benchmarkMedian(heroBenchmarks, 'kills_per_min')

  const gpmDelta = gpmAvg != null ? Math.round(stats.gpm - gpmAvg) : null
  const xpmDelta = xpmAvg != null ? Math.round(stats.xpm - xpmAvg) : null
  const killsDelta = kpmAvg != null ? Math.round(stats.kills - kpmAvg * elapsedMin) : null

  const pct = overallPercentile(player)

  return (
    <div className="rounded" style={{ background: '#12100c', border: '1px solid #26221a' }}>
      <div
        className="text-center text-[11px] font-bold uppercase tracking-widest py-1.5"
        style={{ color: '#948e7c', fontFamily: 'var(--font-dota)', borderBottom: '1px solid #26221a' }}
      >
        vs Their Averages for This Hero
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>GPM</span>
          <DeltaValue value={stats.gpm} delta={gpmDelta} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>Deaths</span>
          <DeltaValue value={stats.deaths} delta={null} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>XPM</span>
          <DeltaValue value={stats.xpm} delta={xpmDelta} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>Assists</span>
          <DeltaValue value={stats.assists} delta={null} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>Kills</span>
          <DeltaValue value={stats.kills} delta={killsDelta} />
        </div>
      </div>
      {/* Percentile bar */}
      <div className="px-4 pb-3">
        <div
          className="relative h-[10px] rounded-full"
          style={{ background: 'linear-gradient(90deg, #a23a2a 0%, #b0902a 50%, #4a9a3a 100%)' }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full overflow-hidden"
            style={{ left: `${pct * 100}%`, width: 18, height: 18, border: '2px solid #e8e2d4', background: '#161310' }}
          >
            {hero && (
              <img src={heroIconUrl(hero.name)} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
        <div className="text-center text-[9px] uppercase tracking-widest mt-1" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
          Average
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detail panel                                                        */
/* ------------------------------------------------------------------ */

function DetailPanel({
  player,
  hero,
  allPlayers,
  idToName,
  itemConst,
  timeSec,
  durationSec,
  isRadiant,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  allPlayers: MatchPlayer[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  timeSec: number
  durationSec: number
  isRadiant: boolean
}) {
  const teamColor = isRadiant ? '#8ec63f' : '#d14a38'
  const playerName = player.personaname ?? player.name ?? 'Anonymous'
  const items = itemsAtTime(player, idToName, timeSec)
  const style = playStyle(player, allPlayers)
  const stats = statsAtTime(player, allPlayers, hero?.name ?? '', timeSec, durationSec)
  const elapsedMin = Math.max(1, Math.round(Math.min(timeSec, durationSec) / 60))

  const heroBench = useQuery({
    queryKey: ['hero_benchmarks', player.hero_id],
    queryFn: () => opendota.heroBenchmarks(player.hero_id),
    staleTime: 60 * 60 * 1000,
    enabled: player.hero_id > 0,
  })

  return (
    <div className="flex gap-4 min-w-0">
      {/* Info column */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Header box */}
        <div
          className="flex items-center gap-3 rounded px-3 py-2.5"
          style={{ background: `linear-gradient(90deg, ${teamColor}18, #12100c)`, border: `1px solid ${teamColor}30` }}
        >
          {hero && (
            <img
              src={heroIconUrl(hero.name)}
              alt=""
              className="w-11 h-11 rounded shrink-0"
              onError={(e) => {
                const img = e.currentTarget
            img.onerror = null
            img.src = heroIconFromPath(hero.icon)
              }}
            />
          )}
          <div className="min-w-0">
            <div
              className="text-[20px] font-bold leading-tight truncate"
              style={{ color: '#f0eae0', fontFamily: 'var(--font-dota)' }}
            >
              {playerName}
            </div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
              Lvl {stats.level} · {hero?.localized_name ?? ''}
            </div>
          </div>
        </div>

        {/* Item grid 2×3 */}
        <div className="grid grid-cols-3 gap-1.5" style={{ maxWidth: 200 }}>
          {items.map((id, i) => {
            const name = id ? (idToName.get(id) ?? null) : null
            return (
              <ItemIcon
                key={i}
                name={name}
                meta={name ? itemConst[name] : undefined}
                width={62}
                height={46}
                className="w-full"
              />
            )
          })}
        </div>

        <PlayStyleBars style={style} />

        <VsAveragesBox
          player={player}
          hero={hero}
          stats={stats}
          heroBenchmarks={heroBench.data}
          elapsedMin={elapsedMin}
        />
      </div>

      {/* Hero render column */}
      <div className="shrink-0 flex flex-col items-center" style={{ width: 150 }}>
        <div className="relative overflow-hidden rounded w-full" style={{ height: 320, background: '#100e0b' }}>
          {hero ? (
            <HeroRender hero={hero} className="absolute inset-0 w-full h-full object-cover" objectPosition="center top" />
          ) : null}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(4,10,18,0.92) 100%)' }}
          />
        </div>
        <div className="flex items-center gap-1 mt-2">
          <GoldIcon size={13} />
          <span className="text-[16px] font-bold tabular-nums" style={{ color: '#d8bf6a', fontFamily: 'var(--font-dota)' }}>
            {stats.netWorth.toLocaleString()}
          </span>
        </div>
        <div className="text-[16px] font-bold tabular-nums mt-0.5" style={{ fontFamily: 'var(--font-dota)' }}>
          <span style={{ color: '#57c262' }}>{stats.kills}</span>
          <span style={{ color: '#5a5446' }}> / </span>
          <span style={{ color: '#e84747' }}>{stats.deaths}</span>
          <span style={{ color: '#5a5446' }}> / </span>
          <span style={{ color: '#dcd6c8' }}>{stats.assists}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Game time slider                                                    */
/* ------------------------------------------------------------------ */

function GameTimeSlider({
  timeSec,
  duration,
  onChange,
}: {
  timeSec: number
  duration: number
  onChange: (t: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = duration > 0 ? Math.min(1, Math.max(0, timeSec / duration)) : 0

  function setFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    onChange(Math.round(f * duration))
  }

  return (
    <div className="flex items-center gap-3 select-none">
      <button
        type="button"
        onClick={() => onChange(duration)}
        className="text-[10px] uppercase tracking-widest shrink-0"
        style={{ color: pct >= 1 ? '#c9a94a' : '#77715f', fontFamily: 'var(--font-dota)' }}
        title="Jump to end"
      >
        Live
      </button>
      <div
        ref={trackRef}
        className="relative flex-1 h-6 flex items-center cursor-pointer"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dragging.current = true
          setFromClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromClientX(e.clientX)
        }}
        onPointerUp={(e) => {
          dragging.current = false
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        <div className="absolute left-0 right-0 h-[4px] rounded-full" style={{ background: '#26221a' }} />
        <div className="absolute left-0 h-[4px] rounded-full" style={{ width: `${pct * 100}%`, background: '#5a6a72' }} />
        <div
          className="absolute -translate-x-1/2 flex items-center justify-center rounded"
          style={{
            left: `${pct * 100}%`,
            minWidth: 52,
            height: 22,
            background: '#1a160f',
            border: '1px solid #5a6a72',
            boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}
        >
          <span className="text-[12px] font-bold tabular-nums px-1" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
            {formatClock(timeSec)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Back button                                                         */
/* ------------------------------------------------------------------ */

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded px-3 py-2 text-[10px] font-bold uppercase tracking-widest leading-tight text-center transition-colors"
      style={{ background: '#1a160f', border: '1px solid #332e20', color: '#a09a86', fontFamily: 'var(--font-dota)' }}
    >
      Back to
      <br />
      Team View
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export function MatchOverview({
  match,
  heroStats,
  idToName,
  itemConst,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = match.players.filter((p) => p.player_slot < 128)
  const dire = match.players.filter((p) => p.player_slot >= 128)

  const [selRadiant, setSelRadiant] = useState<number | null>(null)
  const [selDire, setSelDire] = useState<number | null>(null)
  const [timeSec, setTimeSec] = useState<number>(match.duration)

  const anySelected = selRadiant != null || selDire != null

  function selectHero(player: MatchPlayer) {
    if (player.player_slot < 128) setSelRadiant(player.player_slot)
    else setSelDire(player.player_slot)
    // reset slider to end whenever a new hero is opened
    setTimeSec(match.duration)
  }

  const selRadiantPlayer = radiant.find((p) => p.player_slot === selRadiant)
  const selDirePlayer = dire.find((p) => p.player_slot === selDire)

  /* ---- Team view (nothing selected) ---- */
  if (!anySelected) {
    return (
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-2 min-w-full">
          <div className="flex items-stretch gap-1">
            <div className="flex gap-1 shrink-0">
              {radiant.map((p) => (
                <HeroPortraitCard
                  key={p.player_slot}
                  player={p}
                  hero={heroMap.get(p.hero_id)}
                  isRadiant
                  onClick={() => selectHero(p)}
                />
              ))}
            </div>
            <div className="w-6 shrink-0" />
            <div className="flex gap-1 shrink-0">
              {dire.map((p) => (
                <HeroPortraitCard
                  key={p.player_slot}
                  player={p}
                  hero={heroMap.get(p.hero_id)}
                  isRadiant={false}
                  onClick={() => selectHero(p)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-dota)' }}>
            <div style={{ width: `${5 * 118 + 4 * 4}px`, color: '#8ec63f' }}>Radiant</div>
            <div className="w-6" />
            <div style={{ color: '#d14a38' }}>Dire</div>
          </div>
        </div>
      </div>
    )
  }

  /* ---- Selection view (1 or 2 heroes) ---- */
  // Plain render helper (NOT a component) so DetailPanel keeps a stable identity
  // across slider drags and does not remount / reload images on every re-render.
  const renderTeamSide = (
    isRadiant: boolean,
    players: MatchPlayer[],
    selectedSlot: number | null,
    selectedPlayer: MatchPlayer | undefined,
  ) => {
    // Collapsed → thumbnail strip + detail panel
    if (selectedSlot != null && selectedPlayer) {
      return (
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <ThumbStrip
              players={players}
              heroMap={heroMap}
              selectedSlot={selectedSlot}
              onSelect={(slot) => (isRadiant ? setSelRadiant(slot) : setSelDire(slot))}
            />
            <BackButton onClick={() => (isRadiant ? setSelRadiant(null) : setSelDire(null))} />
          </div>
          <DetailPanel
            player={selectedPlayer}
            hero={heroMap.get(selectedPlayer.hero_id)}
            allPlayers={match.players}
            idToName={idToName}
            itemConst={itemConst}
            timeSec={timeSec}
            durationSec={match.duration}
            isRadiant={isRadiant}
          />
        </div>
      )
    }

    // Expanded → full portrait cards
    return (
      <div className="shrink-0 space-y-2">
        <div className="flex gap-1">
          {players.map((p) => (
            <HeroPortraitCard
              key={p.player_slot}
              player={p}
              hero={heroMap.get(p.hero_id)}
              isRadiant={isRadiant}
              onClick={() => selectHero(p)}
            />
          ))}
        </div>
        <div
          className="text-[11px] uppercase tracking-widest font-semibold"
          style={{ color: isRadiant ? '#8ec63f' : '#d14a38', fontFamily: 'var(--font-dota)' }}
        >
          {isRadiant ? 'Radiant' : 'Dire'}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="space-y-5" style={{ minWidth: 1080 }}>
        <div className="flex items-start gap-6">
          {renderTeamSide(true, radiant, selRadiant, selRadiantPlayer)}
          {renderTeamSide(false, dire, selDire, selDirePlayer)}
        </div>

        <GameTimeSlider timeSec={timeSec} duration={match.duration} onChange={setTimeSec} />
      </div>
    </div>
  )
}
