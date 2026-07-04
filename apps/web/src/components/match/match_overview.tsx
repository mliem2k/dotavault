import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { HeroBenchmarks, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import {
  AGHS_SCEPTER_CDN,
  AGHS_SHARD_CDN,
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
import { PlayerAvatar, PlayerNameLink, usePlayerName } from './match_roster'
import { GameTimeSlider, hasTimeline, itemsAtTime, statsAtTime, type TimedStats } from './match_time'

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

// Animated hero renders (kept on Valve's CDN, the webm clips are ~1.3MB each).
const RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders'

/* Horizontal center of the hero model inside its square render, measured from
   each render's alpha channel (percent from the left edge). Narrow portrait
   crops use this as the object-position x so off-center models (Sven, Ember
   Spirit, Kunkka, ...) stay in frame. Heroes near 50% are omitted. */
const RENDER_CENTER_X: Record<string, number> = {
  abaddon: 57, abyssal_underlord: 53, alchemist: 56, ancient_apparition: 54,
  axe: 62, bane: 54, bounty_hunter: 54, brewmaster: 57,
  bristleback: 68, centaur: 54, dark_seer: 53, dawnbreaker: 46,
  dazzle: 57, doom_bringer: 56, dragon_knight: 60, drow_ranger: 57,
  ember_spirit: 67, enigma: 58, grimstroke: 55, huskar: 44,
  jakiro: 58, juggernaut: 56, keeper_of_the_light: 57, kunkka: 68,
  legion_commander: 57, life_stealer: 46, lion: 57, luna: 54,
  mars: 56, medusa: 58, meepo: 53, monkey_king: 64,
  morphling: 56, naga_siren: 58, necrolyte: 55, nevermore: 53,
  night_stalker: 55, nyx_assassin: 43, ogre_magi: 46, omniknight: 53,
  oracle: 56, pangolier: 65, phantom_assassin: 57, phantom_lancer: 57,
  primal_beast: 47, puck: 55, pudge: 57, pugna: 43,
  rattletrap: 56, razor: 54, riki: 46, shadow_demon: 53,
  slardar: 42, snapfire: 57, sniper: 41, spectre: 58,
  spirit_breaker: 59, storm_spirit: 54, sven: 62, templar_assassin: 46,
  terrorblade: 57, tidehunter: 53, tiny: 46, troll_warlord: 60,
  tusk: 58, ursa: 56, vengefulspirit: 63, void_spirit: 53,
  windrunner: 53,
}

// object-position that keeps the hero model centered in a narrow crop.
function renderObjectPosition(hero: HeroStat): string {
  const short = hero.name.replace('npc_dota_hero_', '')
  return `${RENDER_CENTER_X[short] ?? 50}% top`
}

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

const GoldIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" className="inline-block shrink-0">
    <circle cx="5" cy="5" r="4.5" fill="#e5b12c" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#5a4106" fontWeight="bold">$</text>
  </svg>
)

/* ------------------------------------------------------------------ */
/* Data derivations                                                    */
/* ------------------------------------------------------------------ */

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
  const playerName = usePlayerName(player)
  const hasScepter = (player.aghanims_scepter ?? 0) > 0
  const hasShard = (player.aghanims_shard ?? 0) > 0

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
              objectPosition={renderObjectPosition(hero)}
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
        <div className="shrink-0 px-2 py-1.5 flex flex-col items-center text-center" style={{ background: 'rgba(10,12,14,0.85)' }}>
          <div className="flex items-center justify-center gap-1 mb-0.5">
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

      {/* Aghanim's Scepter/Shard badges under the card, like the client */}
      {(hasScepter || hasShard) && (
        <div className="mt-1.5 flex items-center justify-center gap-1">
          {hasScepter && (
            <div
              className="flex items-center justify-center"
              style={{ width: 32, height: 32, background: 'rgba(13,16,18,0.9)', border: `1px solid ${C.panelBorder}` }}
              title="Aghanim's Scepter"
            >
              <img src={AGHS_SCEPTER_CDN} alt="Aghanim's Scepter" style={{ width: 24, height: 24 }} />
            </div>
          )}
          {hasShard && (
            <div
              className="flex items-center justify-center"
              style={{ width: 32, height: 32, background: 'rgba(13,16,18,0.9)', border: `1px solid ${C.panelBorder}` }}
              title="Aghanim's Shard"
            >
              <img src={AGHS_SHARD_CDN} alt="Aghanim's Shard" style={{ width: 24, height: 24 }} />
            </div>
          )}
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
    <div className="flex gap-2 flex-wrap">
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
  const items = itemsAtTime(player, idToName, timeSec, durationSec, itemConst)
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
    <div className="flex flex-wrap gap-5 min-w-0">
      {/* Info column */}
      <div className="flex-1 min-w-[300px] space-y-3" style={{ maxWidth: 360 }}>
        {/* Name panel — player avatar + profile link */}
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'rgba(8,10,12,0.9)' }}>
          <PlayerAvatar accountId={player.account_id} active={false} size={48} />
          <div className="min-w-0">
            <PlayerNameLink
              player={player}
              className="block text-[24px] leading-tight truncate"
              style={{ color: '#ffffff', fontFamily: 'var(--font-dota)' }}
            />
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

      {/* Hero render column — fills the remaining width so the model isn't
          clipped into a narrow strip; stats centered beneath it */}
      <div className="flex-1 flex flex-col items-center min-w-[240px]" style={{ maxWidth: 460 }}>
        <div className="relative overflow-hidden w-full" style={{ height: 500 }}>
          {hero ? (
            <HeroRender
              hero={hero}
              className="absolute inset-0 w-full h-full object-cover"
              objectPosition={renderObjectPosition(hero)}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <GoldIcon size={15} />
          <span className="text-[19px] tabular-nums" style={{ color: C.gold, fontFamily: 'var(--font-dota)' }}>
            {stats.netWorth.toLocaleString()}
          </span>
        </div>
        <div className="text-[21px] tabular-nums mt-0.5 text-center" style={{ fontFamily: 'var(--font-dota)' }}>
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
  // Valve replays can be reconstructed from cluster + salt when the API
  // omits replay_url. Only offer the link once the match is actually
  // parsed (unparsed matches don't have a real replay to download yet, and
  // shouldn't show a placeholder for one).
  const replayUrl =
    match.version != null
      ? (match.replay_url ??
        (match.replay_salt != null && match.cluster
          ? `http://replay${match.cluster}.valve.net/570/${match.match_id}_${match.replay_salt}.dem.bz2`
          : null))
      : null
  const [parseState, setParseState] = useState<'idle' | 'requesting' | 'requested' | 'failed'>('idle')
  async function requestParse() {
    if (parseState === 'requesting' || parseState === 'requested') return
    setParseState('requesting')
    try {
      await opendota.requestParse(String(match.match_id))
      setParseState('requested')
    } catch {
      setParseState('failed')
    }
  }
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
          style={{ fontSize: 64, lineHeight: 1, color: C.green, fontFamily: 'var(--font-dota)', textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 14px rgba(159,191,63,0.4)' }}
        >
          {match.radiant_score}
        </span>
        <div className="text-center" style={{ fontFamily: 'var(--font-dota)' }}>
          <div className="text-[13px] uppercase" style={{ color: '#aab8c2', letterSpacing: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {GAME_MODES[match.game_mode] ?? `Mode ${match.game_mode}`}
          </div>
          <div className="text-[13px] uppercase" style={{ color: '#93a2ad', letterSpacing: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            Duration <span className="ml-1 text-[17px]" style={{ color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{formatDuration(match.duration)}</span>
          </div>
        </div>
        <span
          className="tabular-nums"
          style={{ fontSize: 64, lineHeight: 1, color: C.red, fontFamily: 'var(--font-dota)', textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 14px rgba(201,74,56,0.4)' }}
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
          textShadow: `0 2px 8px rgba(0,0,0,0.9), 0 0 24px ${winnerColor}88`,
        }}
      >
        {winnerLabel}
      </div>
    </div>
  )

  /* Footer: replay button + match id / date (team view only) */
  const footer = (
    <div className="flex flex-col items-center gap-5 pt-10 pb-6" style={{ fontFamily: 'var(--font-dota)' }}>
      <div className="flex items-center gap-3">
        {replayUrl && (
          <a
            href={replayUrl}
            className="px-6 py-2 text-[15px] uppercase hover:brightness-125"
            style={{ background: '#0e2233', border: '1px solid #24455f', color: '#4faee3', letterSpacing: '2px' }}
          >
            Download Replay
          </a>
        )}
        {match.version == null && (
          <button
            type="button"
            onClick={requestParse}
            disabled={parseState === 'requesting' || parseState === 'requested'}
            className="px-6 py-2 text-[15px] uppercase cursor-pointer hover:brightness-125 disabled:cursor-default"
            style={{
              background: '#1d2a12',
              border: '1px solid #3d5a24',
              color: '#9fbf3f',
              letterSpacing: '2px',
              opacity: parseState === 'requested' ? 0.6 : 1,
            }}
          >
            {parseState === 'idle' && 'Request Parse'}
            {parseState === 'requesting' && 'Requesting…'}
            {parseState === 'requested' && 'Parse Requested'}
            {parseState === 'failed' && 'Retry Parse'}
          </button>
        )}
      </div>
      {parseState === 'requested' && (
        <div className="text-[13px]" style={{ color: '#8a97a0' }}>
          Parse queued at OpenDota — full stats usually appear within a few minutes. Refresh to check.
        </div>
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
    // Collapsed → thumbnail strip + detail panel. Capped at half the page so
    // a single selected side doesn't sprawl over the other team's cards.
    if (selectedSlot != null && selectedPlayer) {
      return (
        <div className="flex-1 min-w-0 space-y-4" style={{ maxWidth: '50%' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
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

  // The scrubber only makes sense when the match has per-time data to show.
  const scrubbable = hasTimeline(match)

  // The selected side's detail panel is the important content and should
  // never be the one that gets pushed offscreen by the other (fixed-width)
  // team's portrait strip, so put whichever side is actually selected first.
  const direOnly = selDire != null && selRadiant == null
  const radiantSide = renderTeamSide(true, radiant, selRadiant, selRadiantPlayer)
  const direSide = renderTeamSide(false, dire, selDire, selDirePlayer)

  return (
    <div className="overflow-x-auto">
      <div className="space-y-6" style={{ minWidth: 1080 }}>
        <div className="flex items-start gap-8">
          {direOnly ? (
            <>
              {direSide}
              {radiantSide}
            </>
          ) : (
            <>
              {radiantSide}
              {direSide}
            </>
          )}
        </div>

        {scrubbable && (
          <GameTimeSlider timeSec={timeSec} duration={match.duration} onChange={setTimeSec} />
        )}
      </div>
    </div>
  )
}
