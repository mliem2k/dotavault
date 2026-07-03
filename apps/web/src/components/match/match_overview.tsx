import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { HeroBenchmarks, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import {
  cdnFallback,
  formatDuration,
  heroIconFromPath,
  heroIconUrl,
  heroLandscapeCdn,
  heroLandscapeUrl,
  heroVertCdn,
  heroVertUrl,
} from '@/lib/utils'
import { ItemIcon } from './item_icon'
import { levelFromXp } from './match_roster'

const GAME_MODES: Record<number, string> = {
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  12: 'Least Played',
  16: 'Captains Draft',
  22: 'All Pick',
  23: 'Turbo',
}

// Animated hero renders (kept on Valve's CDN — the webm clips are ~1.3MB each).
const RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders'
const AGHS_SCEPTER = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes/stats/aghs_scepter.png'

// Client palette (post-game screens).
const C = {
  label: '#67757f',
  labelBright: '#8a97a0',
  white: '#ffffff',
  text: '#cfd4d8',
  gold: '#f2c94c',
  green: '#9fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.85)',
  panelBorder: '#22282c',
}

// Animated hero render, falling back to the self-hosted static portrait if the
// clip is unavailable.
function HeroRender({
  hero,
  className,
  objectPosition = 'center top',
  scale = 1,
}: {
  hero: HeroStat
  className?: string
  objectPosition?: string
  scale?: number
}) {
  const [failed, setFailed] = useState(false)
  const playedRef = useRef(false)
  const shortName = hero.name.replace('npc_dota_hero_', '')
  const style = { objectPosition, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'center top' }

  // Fall back to the static portrait if the clip isn't playable in time.
  useEffect(() => {
    if (failed) return
    const t = setTimeout(() => {
      if (!playedRef.current) setFailed(true)
    }, 5000)
    return () => clearTimeout(t)
  }, [failed])

  if (failed) {
    return (
      <img
        src={heroVertUrl(hero.name)}
        alt={hero.localized_name}
        className={className}
        style={style}
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
      style={style}
      onCanPlay={() => { playedRef.current = true }}
      onError={() => setFailed(true)}
    >
      <source type="video/webm" src={`${RENDER}/${shortName}.webm`} />
      <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${shortName}.mov`} />
    </video>
  )
}

function formatClock(seconds: number): string {
  const neg = seconds < 0
  const abs = Math.abs(Math.floor(seconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

const GoldIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" className="inline-block shrink-0">
    <circle cx="5" cy="5" r="4.5" fill="#e5b12c" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#5a4106" fontWeight="bold">$</text>
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
// Null-safe for unparsed matches where damage/healing fields are missing.
function playStyle(player: MatchPlayer, all: MatchPlayer[]): PlayStyle {
  const maxOf = (f: (p: MatchPlayer) => number) => Math.max(1, ...all.map(f))
  const supportRaw = (p: MatchPlayer) =>
    (p.hero_healing ?? 0) + (p.obs_placed ?? 0) * 200 + (p.sen_placed ?? 0) * 120 + p.assists * 40
  const fightRaw = (p: MatchPlayer) => p.kills + p.assists + (p.hero_damage ?? 0) / 1000
  const pushRaw = (p: MatchPlayer) => (p.tower_damage ?? 0) + (p.gold_per_min ?? 0)
  const scale = (v: number) => Math.min(10, Math.max(0, v * 10))
  return {
    support: scale(supportRaw(player) / maxOf(supportRaw)),
    pushing: scale(pushRaw(player) / maxOf(pushRaw)),
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
  onClick,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  onClick: () => void
}) {
  const playerName = player.personaname ?? player.name ?? 'Anonymous'
  const hasAghs = (player.aghanims_scepter ?? 0) > 0

  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: 118 }}>
      <button
        type="button"
        onClick={onClick}
        className="group relative overflow-hidden flex flex-col w-full text-left cursor-pointer"
        style={{ height: 360, background: 'rgba(13,16,18,0.9)', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
      >
        {/* Player name strip above the portrait */}
        <div
          className="shrink-0 flex items-center justify-center px-1.5 text-center"
          style={{ minHeight: 42, background: 'rgba(10,12,14,0.85)' }}
        >
          <span
            className="block text-[13px] leading-tight line-clamp-2 group-hover:text-white"
            style={{ color: '#e8ecef', fontFamily: 'var(--font-dota)' }}
          >
            {playerName}
          </span>
        </div>

        {/* Portrait */}
        <div className="relative flex-1 overflow-hidden">
          {hero ? (
            <HeroRender
              hero={hero}
              className="absolute inset-0 w-full h-full object-cover"
              objectPosition="center top"
              scale={1.15}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: '#14181b' }} />
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, transparent 70%, rgba(6,8,10,0.9) 100%)' }}
          />
        </div>

        {/* Net worth + KDA below the artwork */}
        <div className="shrink-0 px-2 py-1.5" style={{ background: 'rgba(10,12,14,0.85)' }}>
          <div className="flex items-center gap-1 mb-0.5">
            <GoldIcon size={12} />
            <span className="text-[14px] leading-none tabular-nums" style={{ color: C.gold, fontFamily: 'var(--font-dota)' }}>
              {player.net_worth.toLocaleString()}
            </span>
          </div>
          <div className="text-[14px] tabular-nums leading-none" style={{ fontFamily: 'var(--font-dota)' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>{player.kills}</span>
            <span style={{ color: '#5a6066' }}> / </span>
            <span style={{ color: C.text }}>{player.deaths}</span>
            <span style={{ color: '#5a6066' }}> / </span>
            <span style={{ color: C.text }}>{player.assists}</span>
          </div>
        </div>
      </button>

      {/* Aghanim's Scepter badge under the card, like the client */}
      {hasAghs && (
        <div
          className="mt-1.5 flex items-center justify-center"
          style={{ width: 32, height: 32, background: 'rgba(13,16,18,0.9)', border: `1px solid ${C.panelBorder}` }}
        >
          <img src={AGHS_SCEPTER} alt="Aghanim's Scepter" style={{ width: 24, height: 24 }} />
        </div>
      )}
    </div>
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
    <div className="flex gap-2">
      {players.map((p) => {
        const hero = heroMap.get(p.hero_id)
        const active = p.player_slot === selectedSlot
        return (
          <button
            key={p.player_slot}
            type="button"
            onClick={() => onSelect(p.player_slot)}
            className="relative shrink-0 overflow-hidden transition-all cursor-pointer"
            style={{
              width: 104,
              height: 59,
              border: active ? '1px solid rgba(255,255,255,0.9)' : '1px solid transparent',
              filter: active ? 'none' : 'brightness(0.45)',
            }}
            title={p.personaname ?? p.name ?? ''}
          >
            {hero && (
              <img
                src={heroLandscapeUrl(hero.name)}
                alt={hero.localized_name}
                className="w-full h-full object-cover"
                onError={cdnFallback(heroLandscapeCdn(hero.name))}
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
        className="text-center text-[12px] uppercase mb-2"
        style={{ color: '#b8c4cc', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
      >
        Play Style in This Match
      </div>
      <div className="space-y-2">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-16 shrink-0 text-[11px] uppercase text-right"
              style={{ color: C.labelBright, fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
            >
              {label}
            </span>
            <div className="flex-1 h-[5px] overflow-hidden" style={{ background: '#3a4147' }}>
              <div className="h-full" style={{ width: `${(val / 10) * 100}%`, background: '#a9c53d' }} />
            </div>
            <span className="w-7 shrink-0 text-[11px] tabular-nums" style={{ color: '#e8ecef', fontFamily: 'var(--font-dota)' }}>
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
  const color = delta == null ? '#e8ecef' : delta >= 0 ? '#7ac74f' : '#d95f4a'
  return (
    <span className="text-[13px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-dota)' }}>
      {value.toLocaleString()}
      {delta != null && (
        <span className="text-[12px] ml-1">
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

  const row = (label: string, value: number, delta: number | null) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase" style={{ color: C.labelBright, fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}>
        {label}:
      </span>
      <DeltaValue value={value} delta={delta} />
    </div>
  )

  return (
    <div style={{ background: 'rgba(24,30,33,0.85)', border: `1px solid ${C.panelBorder}` }}>
      <div
        className="text-[11px] uppercase px-3 pt-2"
        style={{ color: '#b8c4cc', fontFamily: 'var(--font-dota)', letterSpacing: '1px' }}
      >
        vs Their Averages for This Hero
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2">
        <div className="space-y-1">
          {row('GPM', stats.gpm, gpmDelta)}
          {row('XPM', stats.xpm, xpmDelta)}
          {row('Kills', stats.kills, killsDelta)}
        </div>
        <div className="space-y-1">
          {row('Deaths', stats.deaths, null)}
          {row('Assists', stats.assists, null)}
        </div>
      </div>
      {/* Percentile bar */}
      <div className="px-3 pb-3">
        <div
          className="relative h-[6px]"
          style={{ background: 'linear-gradient(90deg, #a63426 0%, #2c3236 50%, #4a9a3a 100%)' }}
        >
          <div className="absolute top-[-3px] bottom-[-3px]" style={{ left: '50%', width: 1, background: '#8a97a0' }} />
          <div
            className="absolute -translate-x-1/2 overflow-hidden"
            style={{ left: `${pct * 100}%`, bottom: 2, width: 26, height: 26, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}
          >
            {hero && <img src={heroIconUrl(hero.name)} alt="" className="w-full h-full object-cover" />}
          </div>
        </div>
        <div className="text-center text-[10px] uppercase mt-1" style={{ color: C.labelBright, fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}>
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
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  allPlayers: MatchPlayer[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  timeSec: number
  durationSec: number
}) {
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
    <div className="flex gap-5 min-w-0">
      {/* Info column */}
      <div className="flex-1 min-w-0 space-y-3" style={{ maxWidth: 360 }}>
        {/* Name panel */}
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'rgba(8,10,12,0.9)' }}>
          {hero && (
            <img
              src={heroIconUrl(hero.name)}
              alt=""
              className="w-12 h-12 shrink-0"
              onError={(e) => {
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(hero.icon)
              }}
            />
          )}
          <div className="min-w-0">
            <div
              className="text-[24px] leading-tight truncate"
              style={{ color: '#ffffff', fontFamily: 'var(--font-dota)' }}
            >
              {playerName}
            </div>
            <div className="text-[12px] uppercase" style={{ color: '#86a34c', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}>
              Lvl {stats.level} {hero?.localized_name ?? ''}
            </div>
          </div>
        </div>

        {/* Item grid 2×3 */}
        <div className="grid grid-cols-3 gap-2" style={{ maxWidth: 300 }}>
          {items.map((id, i) => {
            const name = id ? (idToName.get(id) ?? null) : null
            return (
              <div key={i} style={{ background: 'rgba(10,13,15,0.9)', border: `1px solid ${C.panelBorder}` }}>
                <ItemIcon
                  name={name}
                  meta={name ? itemConst[name] : undefined}
                  width={88}
                  height={64}
                  className="w-full"
                />
              </div>
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
      <div className="shrink-0 flex flex-col" style={{ width: 230 }}>
        <div className="relative overflow-hidden w-full" style={{ height: 400 }}>
          {hero ? (
            <HeroRender hero={hero} className="absolute inset-0 w-full h-full object-cover" objectPosition="center top" />
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <GoldIcon size={15} />
          <span className="text-[19px] tabular-nums" style={{ color: C.gold, fontFamily: 'var(--font-dota)' }}>
            {stats.netWorth.toLocaleString()}
          </span>
        </div>
        <div className="text-[21px] tabular-nums mt-0.5" style={{ fontFamily: 'var(--font-dota)' }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{stats.kills}</span>
          <span style={{ color: '#5a6066' }}> / </span>
          <span style={{ color: C.text }}>{stats.deaths}</span>
          <span style={{ color: '#5a6066' }}> / </span>
          <span style={{ color: C.text }}>{stats.assists}</span>
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
    <div className="mx-auto select-none" style={{ width: '46%', minWidth: 320 }}>
      <div
        ref={trackRef}
        className="relative h-7 flex items-center cursor-pointer"
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
        <div
          className="absolute left-0 right-0 h-[12px]"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.35)' }}
        />
        <div className="absolute left-0 h-[12px]" style={{ width: `${pct * 100}%`, background: 'rgba(255,255,255,0.18)' }} />
        <div
          className="absolute -translate-x-1/2 flex items-center justify-center"
          style={{
            left: `${pct * 100}%`,
            minWidth: 62,
            height: 26,
            background: '#15181b',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.7)',
          }}
        >
          <span className="text-[14px] tabular-nums px-1.5" style={{ color: '#ffffff', fontFamily: 'var(--font-dota)' }}>
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
      className="shrink-0 px-4 py-2 text-[11px] uppercase leading-snug text-center transition-colors cursor-pointer hover:brightness-125"
      style={{ background: '#22282c', color: '#cfd4d8', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
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

  const winnerLabel = match.radiant_win ? 'Radiant Victory' : 'Dire Victory'
  const winnerColor = match.radiant_win ? C.green : C.red
  const startDate = new Date(match.start_time * 1000)
  const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`

  /* Score header (team view only, like the client) */
  const scoreHeader = (
    <div className="relative flex items-center justify-center py-4">
      <div className="flex items-center gap-5">
        <span
          className="tabular-nums"
          style={{ fontSize: 64, lineHeight: 1, color: C.green, fontFamily: 'var(--font-dota)', textShadow: '0 0 12px rgba(159,191,63,0.35)' }}
        >
          {match.radiant_score}
        </span>
        <div className="text-center" style={{ fontFamily: 'var(--font-dota)' }}>
          <div className="text-[13px] uppercase" style={{ color: C.labelBright, letterSpacing: '2px' }}>
            {GAME_MODES[match.game_mode] ?? `Mode ${match.game_mode}`}
          </div>
          <div className="text-[13px] uppercase" style={{ color: C.label, letterSpacing: '2px' }}>
            Duration <span className="ml-1 text-[17px]" style={{ color: '#e8ecef' }}>{formatDuration(match.duration)}</span>
          </div>
        </div>
        <span
          className="tabular-nums"
          style={{ fontSize: 64, lineHeight: 1, color: C.red, fontFamily: 'var(--font-dota)', textShadow: '0 0 12px rgba(201,74,56,0.35)' }}
        >
          {match.dire_score}
        </span>
      </div>
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:block"
        style={{
          fontSize: 44,
          color: winnerColor,
          fontFamily: 'var(--font-dota)',
          textShadow: `0 0 24px ${winnerColor}66`,
        }}
      >
        {winnerLabel}
      </div>
    </div>
  )

  /* Footer: replay button + match id / date (team view only) */
  const footer = (
    <div className="flex flex-col items-center gap-5 pt-10 pb-6" style={{ fontFamily: 'var(--font-dota)' }}>
      {match.replay_url ? (
        <a
          href={match.replay_url}
          className="px-6 py-2 text-[15px] uppercase hover:brightness-125"
          style={{ background: '#0e2233', border: '1px solid #24455f', color: '#4faee3', letterSpacing: '2px' }}
        >
          Download Replay
        </a>
      ) : (
        <span
          className="px-6 py-2 text-[15px] uppercase"
          style={{ background: '#0e2233', border: '1px solid #24455f', color: '#4faee3', letterSpacing: '2px', opacity: 0.45 }}
          title="Replay unavailable"
        >
          Download Replay
        </span>
      )}
      <div className="flex items-center gap-10">
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] uppercase" style={{ color: '#4d6f85', letterSpacing: '2px' }}>Match ID</span>
          <span className="text-[15px] tabular-nums" style={{ color: '#7fa8c4' }}>{match.match_id}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[13px] uppercase" style={{ color: '#4d6f85', letterSpacing: '2px' }}>Match Date / Time</span>
          <span className="text-[15px] tabular-nums" style={{ color: '#7fa8c4' }}>{dateStr}</span>
        </div>
      </div>
    </div>
  )

  /* ---- Team view (nothing selected) ---- */
  if (!anySelected) {
    return (
      <div className="overflow-x-auto">
        <div style={{ minWidth: 1080 }}>
          {scoreHeader}
          <div className="flex items-start justify-center gap-1 mt-2">
            <div className="flex gap-1 shrink-0">
              {radiant.map((p) => (
                <HeroPortraitCard
                  key={p.player_slot}
                  player={p}
                  hero={heroMap.get(p.hero_id)}
                  onClick={() => selectHero(p)}
                />
              ))}
            </div>
            <div className="w-16 shrink-0" />
            <div className="flex gap-1 shrink-0">
              {dire.map((p) => (
                <HeroPortraitCard
                  key={p.player_slot}
                  player={p}
                  hero={heroMap.get(p.hero_id)}
                  onClick={() => selectHero(p)}
                />
              ))}
            </div>
          </div>
          {footer}
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
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
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
          />
        </div>
      )
    }

    // Expanded → full portrait cards
    return (
      <div className="shrink-0 flex gap-1">
        {players.map((p) => (
          <HeroPortraitCard
            key={p.player_slot}
            player={p}
            hero={heroMap.get(p.hero_id)}
            onClick={() => selectHero(p)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="space-y-6" style={{ minWidth: 1080 }}>
        <div className="flex items-start gap-8">
          {renderTeamSide(true, radiant, selRadiant, selRadiantPlayer)}
          {renderTeamSide(false, dire, selDire, selDirePlayer)}
        </div>

        <GameTimeSlider timeSec={timeSec} duration={match.duration} onChange={setTimeSec} />
      </div>
    </div>
  )
}
