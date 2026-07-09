import { useRef } from 'react'
import type { ItemConst, Match, MatchPlayer } from 'types'
import { levelFromXp } from './match_roster'

/* Shared game-time scrubbing: reconstructs player stats / inventories at a
   point in time from the parsed series, plus the slider control itself.
   Used by the Overview and Scoreboard tabs. */

export function formatClock(seconds: number): string {
  const neg = seconds < 0
  const abs = Math.abs(Math.floor(seconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

// Whether the match has any per-time data worth scrubbing through.
export function hasTimeline(match: Match): boolean {
  return match.players.some(
    (p) => (p.gold_t?.length ?? 0) > 1 || (p.purchase_log?.length ?? 0) > 0 || (p.kills_log?.length ?? 0) > 0,
  )
}

const INVENTORY_CONSUMABLES = new Set([
  'tpscroll', 'flask', 'clarity', 'faerie_fire', 'smoke_of_deceit', 'dust',
  'ward_observer', 'ward_sentry', 'ward_dispenser', 'tango', 'tango_single',
  'enchanted_mango', 'blood_grenade', 'tome_of_knowledge', 'cheese',
])

// Inventory at `timeSec`, simulated from the purchase log: each purchase
// consumes its components (so Treads hide the Blades of Attack they were
// built from), and items later sold still show while they were owned. The
// end of the slider snaps to the player's real final inventory.
export function itemsAtTime(
  player: MatchPlayer,
  idToName: Map<number, string>,
  timeSec: number,
  durationSec: number,
  itemConst: Record<string, ItemConst> = {},
): number[] {
  const finalItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const log = player.purchase_log ?? []
  if (timeSec >= durationSec || log.length === 0) return finalItems

  const inv: string[] = []
  for (const e of [...log].sort((a, b) => a.time - b.time)) {
    if (e.time > timeSec) break
    if (INVENTORY_CONSUMABLES.has(e.key) || e.key.startsWith('recipe')) continue
    for (const comp of itemConst[e.key]?.components ?? []) {
      const i = inv.indexOf(comp)
      if (i !== -1) inv.splice(i, 1)
    }
    inv.push(e.key)
  }
  const ids = inv
    .map((name) => itemConst[name]?.id ?? 0)
    .filter((id) => id > 0)
    .slice(-6)
  while (ids.length < 6) ids.push(0)
  return ids
}

// Aghanim's Scepter/Shard grant their hero-specific upgrade three different
// ways, each needing different treatment:
//   - 'held': bought and still sitting in their final inventory. Already
//     fully visible in the Items column, so callers that show that column
//     too (the scoreboard) should treat this as redundant, not a "buff".
//   - 'sold': bought at some point (found in purchase_log) but no longer in
//     their final slots, the upgrade stays permanently active even after
//     selling to free up space (confirmed on real match data: a player had
//     aghanims_shard true and the item gone from their final slots, but
//     purchase_log showed a genuine purchase earlier that game). Nothing
//     else in the UI shows this, since the Items column only reflects
//     final state, so this should still surface as a buff.
//   - 'blessing': the summary field says they have the upgrade, but there's
//     no purchase and no item in slots. That can only be Aghanim's Blessing
//     (Roshan-dropped, used instantly on a chosen ally, no item ever
//     enters their inventory). Needs its own badge, showing the shop icon
//     here would imply an item that doesn't exist on this player.
//
// OpenDota's aghanims_scepter/aghanims_shard summary field (computed from
// the parsed permanent_buffs array) is only trustworthy for the Blessing
// case; it can come back false even when the item is clearly owned (a real
// match had permanent_buffs: [] for a player with ultimate_scepter sitting
// in item_0). So: trust the final item slots or purchase history first,
// and only read the summary field when neither shows a personal purchase.
export type UpgradeSource = 'held' | 'sold' | 'blessing' | null

function upgradeSource(
  player: MatchPlayer,
  idToName: Map<number, string>,
  itemName: string,
  summaryField: number | null | undefined,
): UpgradeSource {
  const finalItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  if (finalItems.some((id) => idToName.get(id) === itemName)) return 'held'
  if ((player.purchase_log ?? []).some((e) => e.key === itemName)) return 'sold'
  if ((summaryField ?? 0) > 0) return 'blessing'
  return null
}

export function scepterSource(player: MatchPlayer, idToName: Map<number, string>): UpgradeSource {
  return upgradeSource(player, idToName, 'ultimate_scepter', player.aghanims_scepter)
}

export function shardSource(player: MatchPlayer, idToName: Map<number, string>): UpgradeSource {
  return upgradeSource(player, idToName, 'aghanims_shard', player.aghanims_shard)
}

export function hasMoonshardBuff(player: MatchPlayer): boolean {
  return (player.moonshard ?? 0) > 0 || (player.purchase_log ?? []).some((e) => e.key === 'moon_shard')
}

export type TimedStats = {
  netWorth: number
  kills: number
  deaths: number
  assists: number
  lastHits: number
  denies: number
  level: number
  gpm: number
  xpm: number
}

// Reconstruct a player's stats at slider time `timeSec` from the parsed time
// series (gold_t/xp_t/lh_t) and kill logs. At the end of the game (default
// slider position) this returns the final scoreboard values exactly. Every
// stat falls back to its FINAL value when its own series is missing.
export function statsAtTime(
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
  const dnT = player.dn_t ?? null
  const idx = Math.max(0, Math.floor(timeSec / 60))

  const at = (arr: number[] | null, fallback: number): number => {
    if (atEnd || !arr || arr.length === 0) return fallback
    return arr[Math.min(idx, arr.length - 1)] ?? fallback
  }

  const netWorth = at(goldT, player.net_worth)
  const lastHits = at(lhT, player.last_hits)
  const denies = at(dnT, player.denies)
  const xpVal = xpT && xpT.length ? (xpT[Math.min(idx, xpT.length - 1)] ?? 0) : 0
  const level = atEnd || !xpT?.length ? player.level : levelFromXp(xpVal)
  const minutesElapsed = Math.max(1, timeSec / 60)
  const gpm = atEnd || !goldT?.length ? player.gold_per_min : Math.round(netWorth / minutesElapsed)
  const xpm = atEnd || !xpT?.length ? player.xp_per_min : Math.round(xpVal / minutesElapsed)
  const kills =
    atEnd || !player.kills_log?.length
      ? player.kills
      : player.kills_log.filter((e) => e.time <= timeSec).length
  const hasEnemyKillLogs = allPlayers.some((pl) => (pl.kills_log?.length ?? 0) > 0)
  const deaths =
    atEnd || !hasEnemyKillLogs
      ? player.deaths
      : allPlayers.reduce(
          (s, pl) => s + (pl.kills_log ?? []).filter((e) => e.key === heroName && e.time <= timeSec).length,
          0,
        )
  // Assists have no per-time series in the OpenDota response. Every assist is
  // tied to a team kill, so scale the final count by the team's kill
  // progression at the scrub time — a close approximation when parsed.
  const isRadiant = player.player_slot < 128
  const teammates = allPlayers.filter((pl) => (pl.player_slot < 128) === isRadiant)
  const teamKillsTotal = teammates.reduce((s, pl) => s + (pl.kills_log?.length ?? 0), 0)
  const assists =
    atEnd || teamKillsTotal === 0
      ? player.assists
      : Math.round(
          player.assists *
            (teammates.reduce(
              (s, pl) => s + (pl.kills_log ?? []).filter((e) => e.time <= timeSec).length,
              0,
            ) /
              teamKillsTotal),
        )

  return { netWorth, kills, deaths, assists, lastHits, denies, level, gpm, xpm }
}

/* Hero damage / healing at a point in time. There is no per-minute series,
   so distribute the final totals along each player's cumulative teamfight
   damage/healing curve (fights are where nearly all of both happen); fall
   back to linear-in-time when no teamfight data exists. */
export function damageHealAtTime(
  match: Match,
  player: MatchPlayer,
  timeSec: number,
): { damage: number; healing: number } {
  const finalDmg = player.hero_damage ?? 0
  const finalHeal = player.hero_healing ?? 0
  if (timeSec >= match.duration) return { damage: finalDmg, healing: finalHeal }
  const idx = match.players.findIndex((p) => p.player_slot === player.player_slot)
  let cumD = 0
  let totD = 0
  let cumH = 0
  let totH = 0
  for (const f of match.teamfights ?? []) {
    const tp = f.players[idx]
    if (!tp) continue
    totD += tp.damage
    totH += tp.healing
    if (f.end <= timeSec) {
      cumD += tp.damage
      cumH += tp.healing
    } else if (f.start <= timeSec) {
      const frac = (timeSec - f.start) / Math.max(1, f.end - f.start)
      cumD += tp.damage * frac
      cumH += tp.healing * frac
    }
  }
  const timeFrac = Math.max(0, Math.min(1, timeSec / Math.max(1, match.duration)))
  return {
    damage: totD > 0 ? Math.round(finalDmg * (cumD / totD)) : Math.round(finalDmg * timeFrac),
    healing: totH > 0 ? Math.round(finalHeal * (cumH / totH)) : Math.round(finalHeal * timeFrac),
  }
}

/* Team kill score at a point in time (falls back to the final score). */
export function teamScoreAtTime(match: Match, isRadiant: boolean, timeSec: number): number {
  const finalScore = isRadiant ? match.radiant_score : match.dire_score
  if (timeSec >= match.duration) return finalScore
  const team = match.players.filter((p) => (p.player_slot < 128) === isRadiant)
  if (!team.some((p) => (p.kills_log?.length ?? 0) > 0)) return finalScore
  return team.reduce((s, p) => s + (p.kills_log ?? []).filter((e) => e.time <= timeSec).length, 0)
}

/* Game time slider, styled like the client's post-game scrubber. */
export type TimelineMarker = { time: number; color: string }

export function GameTimeSlider({
  timeSec,
  duration,
  onChange,
  markers,
  fullWidth,
}: {
  timeSec: number
  duration: number
  onChange: (t: number) => void
  markers?: TimelineMarker[]
  fullWidth?: boolean
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
    <div
      className={fullWidth ? 'flex-1 select-none' : 'mx-auto select-none'}
      style={fullWidth ? { minWidth: 200 } : { width: '46%', minWidth: 320 }}
    >
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
        {duration > 0 &&
          markers?.map((m, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static marker list
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: `${Math.min(100, Math.max(0, (m.time / duration) * 100))}%`,
                width: 2,
                height: 12,
                background: m.color,
                opacity: 0.9,
              }}
            />
          ))}
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
          <span className="text-[14px] tabular-nums px-1.5 text-white font-dota">
            {formatClock(timeSec)}
          </span>
        </div>
      </div>
    </div>
  )
}
