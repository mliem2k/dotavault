import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { BUILDINGS, MAP_MAX, MAP_MIN, buildingDeathTimes } from '@/lib/buildings'
import { playerColor } from '@/lib/dotaconst'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { formatClock } from './match_time'

/* Buildings tab: every tower/rax/ancient on the minimap at its exact
   position, destroyed ones dimmed, with a hover tooltip breaking down who
   damaged it (players[].damage carries per-building totals) and who got
   the last hit (objectives building_kill events). Lane clusters show which
   heroes played each lane. */

const C = {
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

const pct = (v: number) => `${((v - MAP_MIN) / (MAP_MAX - MAP_MIN)) * 100}%`

type Attacker = { player: MatchPlayer; hero: HeroStat | undefined; damage: number; lastHit: boolean }
type BuildingInfo = {
  attackers: Attacker[]
  creepDamage: number
  creepLastHit: boolean
  deadAt: number | null
}

function buildInfo(match: Match, heroMap: Map<number, HeroStat>): Map<string, BuildingInfo> {
  const byKey = new Map<string, BuildingInfo>()
  const kills = (match.objectives ?? []).filter((o) => o.type === 'building_kill' && o.key)

  for (const b of BUILDINGS) {
    if (byKey.has(b.key)) continue
    const attackers: Attacker[] = []
    for (const p of match.players) {
      const dmg = p.damage?.[b.key]
      if (!dmg) continue
      attackers.push({ player: p, hero: heroMap.get(p.hero_id), damage: dmg, lastHit: false })
    }
    attackers.sort((a, z) => z.damage - a.damage)

    const killEvents = kills.filter((k) => k.key === b.key)
    let creepLastHit = false
    for (const ev of killEvents) {
      if (ev.player_slot != null) {
        const a = attackers.find((x) => x.player.player_slot === ev.player_slot)
        if (a) a.lastHit = true
      } else {
        creepLastHit = true
      }
    }

    const heroSum = attackers.reduce((s, a) => s + a.damage, 0)
    const maxHp = BUILDINGS.find((x) => x.key === b.key)?.maxHp ?? 0
    // Whatever hero damage doesn't account for was creeps (only meaningful
    // once the building actually died; overkill and backdoor regen make
    // this an estimate, same as OpenDota's own view).
    const died = killEvents.length > 0
    const creepDamage = died ? Math.max(0, maxHp - heroSum) : 0

    byKey.set(b.key, {
      attackers,
      creepDamage,
      creepLastHit,
      deadAt: died ? killEvents[0].time : null,
    })
  }
  return byKey
}

function BuildingTooltip({
  label,
  team,
  maxHp,
  info,
  x,
  y,
}: {
  label: string
  team: 'radiant' | 'dire'
  maxHp: number
  info: BuildingInfo
  x: number
  y: number
}) {
  const W = 280
  const left = Math.max(8, Math.min(x + 14, window.innerWidth - W - 12))
  const top = Math.max(8, Math.min(y + 14, window.innerHeight - 240))
  const total = Math.max(maxHp, info.attackers.reduce((s, a) => s + a.damage, 0) + info.creepDamage)

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left,
        top,
        width: W,
        zIndex: 9999,
        background: '#0b0d0f',
        border: '1px solid #2c3236',
        boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
        padding: '10px 12px',
        fontFamily: 'var(--font-dota)',
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-bold uppercase" style={{ color: team === 'radiant' ? C.green : C.red, letterSpacing: '1px' }}>
          {label}
        </span>
        <span className="text-[12px]" style={{ color: C.dim }}>
          {info.deadAt != null ? `Destroyed ${formatClock(info.deadAt)}` : 'Standing'}
        </span>
      </div>

      {info.attackers.length === 0 && info.creepDamage === 0 ? (
        <div className="py-1 text-[12px]" style={{ color: C.dim }}>
          Took no recorded damage.
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex h-[6px] w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {info.attackers.map((a) => (
              <div
                key={a.player.player_slot}
                style={{ width: `${(a.damage / total) * 100}%`, background: playerColor(a.player.player_slot) }}
              />
            ))}
            {info.creepDamage > 0 && (
              <div style={{ width: `${(info.creepDamage / total) * 100}%`, background: team === 'radiant' ? C.red : C.green, opacity: 0.5 }} />
            )}
          </div>
          <div className="space-y-1">
            {info.attackers.map((a) => (
              <div key={a.player.player_slot} className="flex items-center gap-1.5 text-[12px]">
                {a.hero && (
                  <img
                    src={heroIconUrl(a.hero.name)}
                    alt=""
                    style={{ width: 18, height: 18 }}
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      if (a.hero) img.src = heroIconFromPath(a.hero.icon)
                    }}
                  />
                )}
                <span className="tabular-nums" style={{ color: C.white, minWidth: 38 }}>{a.damage.toLocaleString()}</span>
                <span className="truncate" style={{ color: playerColor(a.player.player_slot) }}>
                  {a.player.personaname ?? 'Anonymous'}
                </span>
                {a.lastHit && (
                  <span className="ml-auto shrink-0" style={{ color: C.gold }}>last hit</span>
                )}
              </div>
            ))}
            {info.creepDamage > 0 && (
              <div className="flex items-center gap-1.5 text-[12px]">
                <span style={{ width: 18, textAlign: 'center', color: C.dim }}>⚔</span>
                <span className="tabular-nums" style={{ color: C.white, minWidth: 38 }}>{info.creepDamage.toLocaleString()}</span>
                <span style={{ color: C.dim }}>creeps</span>
                {info.creepLastHit && <span className="ml-auto shrink-0" style={{ color: C.gold }}>last hit</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* Lane cluster anchor points on the world grid (visual placement only). */
const LANE_ANCHORS: Record<string, { x: number; y: number; label: string }> = {
  'radiant-1': { x: 168, y: 84, label: 'Safe Lane' },
  'radiant-2': { x: 118, y: 110, label: 'Mid Lane' },
  'radiant-3': { x: 82, y: 148, label: 'Off Lane' },
  'radiant-4': { x: 120, y: 88, label: 'Jungle' },
  'dire-1': { x: 88, y: 168, label: 'Safe Lane' },
  'dire-2': { x: 140, y: 142, label: 'Mid Lane' },
  'dire-3': { x: 172, y: 104, label: 'Off Lane' },
  'dire-4': { x: 138, y: 162, label: 'Jungle' },
}

export function MatchBuildings({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const info = buildInfo(match, heroMap)
  const deaths = buildingDeathTimes(match)
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)

  const laneGroups = new Map<string, MatchPlayer[]>()
  for (const p of match.players) {
    if (!p.lane_role) continue
    const key = `${p.player_slot < 128 ? 'radiant' : 'dire'}-${p.lane_role}`
    laneGroups.set(key, [...(laneGroups.get(key) ?? []), p])
  }

  const destroyed = BUILDINGS.map((b, i) => ({ b, i, at: deaths[i] }))
    .filter((e) => e.at !== Number.POSITIVE_INFINITY)
    .sort((a, z) => a.at - z.at)

  return (
    <div className="flex flex-wrap gap-4" style={{ fontFamily: 'var(--font-dota)' }}>
      <div className="min-w-[420px] flex-1" style={{ background: C.panel }}>
        <div className="px-4 py-3 text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}>
          Buildings Map
        </div>
        <div className="flex justify-center p-4">
          <div className="relative w-full max-w-[560px]" style={{ aspectRatio: '1', border: '1px solid #22282c' }}>
            <img src="/minimap.webp" alt="" className="absolute inset-0 h-full w-full" />

            {BUILDINGS.map((b, i) => {
              const dead = deaths[i] !== Number.POSITIVE_INFINITY
              const color = b.team === 'radiant' ? C.green : C.red
              const size = b.kind === 'fort' ? 16 : b.kind === 'tower' ? 11 : 8
              return (
                <span
                  key={`${b.key}-${i}`}
                  className="absolute -translate-x-1/2 translate-y-1/2 cursor-pointer"
                  style={{ left: pct(b.x), bottom: pct(b.y), width: size, height: size, zIndex: 2 }}
                  onMouseEnter={(e) => setHover({ idx: i, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHover({ idx: i, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                >
                  <span
                    className="block h-full w-full"
                    style={{
                      background: dead ? '#3a4147' : color,
                      border: '1px solid #0d1012',
                      borderRadius: b.kind === 'fort' ? '50%' : 2,
                      transform: b.kind === 'rax' ? 'rotate(45deg)' : undefined,
                      opacity: dead ? 0.55 : 1,
                    }}
                  />
                </span>
              )
            })}

            {[...laneGroups.entries()].map(([key, players]) => {
              const anchor = LANE_ANCHORS[key]
              if (!anchor) return null
              return (
                <div
                  key={key}
                  className="absolute flex -translate-x-1/2 translate-y-1/2 gap-0.5"
                  style={{ left: pct(anchor.x), bottom: pct(anchor.y), zIndex: 1 }}
                >
                  {players.map((p) => {
                    const hero = heroMap.get(p.hero_id)
                    return (
                      <img
                        key={p.player_slot}
                        src={hero ? heroIconUrl(hero.name) : ''}
                        alt=""
                        title={`${hero?.localized_name ?? 'Unknown'} · ${anchor.label}`}
                        style={{
                          width: 22,
                          height: 22,
                          border: `1px solid ${p.player_slot < 128 ? C.green : C.red}`,
                          background: 'rgba(8,10,12,0.7)',
                        }}
                        onError={(e) => {
                          if (!hero) return
                          const img = e.currentTarget
                          img.onerror = null
                          img.src = heroIconFromPath(hero.icon)
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <p className="px-4 pb-4 text-center text-[13px]" style={{ color: C.dim }}>
          Hover a building for its damage breakdown. Dimmed buildings were destroyed. Hero icons mark laning assignments.
        </p>
      </div>

      {/* Destruction order */}
      <div className="w-[320px] shrink-0 self-start" style={{ background: C.panel }}>
        <div className="px-4 py-3 text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}>
          Destruction Order
        </div>
        <div className="max-h-[560px] overflow-y-auto">
          {destroyed.map(({ b, i, at }) => {
            const inf = info.get(b.key)
            const killer = inf?.attackers.find((a) => a.lastHit)
            return (
              <div
                key={`${b.key}-${i}`}
                className="flex items-center gap-2.5 px-3 py-2 text-[13px]"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="w-11 shrink-0 text-right tabular-nums" style={{ color: C.dim }}>
                  {formatClock(at)}
                </span>
                <span style={{ width: 3, height: 20, background: b.team === 'radiant' ? C.green : C.red }} />
                <span style={{ color: C.text }}>
                  {b.team === 'radiant' ? 'Radiant' : 'Dire'} {b.label}
                </span>
                {killer?.hero && (
                  <img
                    src={heroIconUrl(killer.hero.name)}
                    alt=""
                    title={`Last hit: ${killer.player.personaname ?? 'Anonymous'}`}
                    className="ml-auto"
                    style={{ width: 20, height: 20 }}
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      if (killer.hero) img.src = heroIconFromPath(killer.hero.icon)
                    }}
                  />
                )}
              </div>
            )
          })}
          {destroyed.length === 0 && (
            <div className="py-8 text-center text-[13px]" style={{ color: C.dim }}>
              No buildings were destroyed.
            </div>
          )}
        </div>
      </div>

      {hover &&
        createPortal(
          <BuildingTooltip
            label={`${BUILDINGS[hover.idx].team === 'radiant' ? 'Radiant' : 'Dire'} ${BUILDINGS[hover.idx].label}`}
            team={BUILDINGS[hover.idx].team}
            maxHp={BUILDINGS[hover.idx].maxHp}
            info={info.get(BUILDINGS[hover.idx].key) ?? { attackers: [], creepDamage: 0, creepLastHit: false, deadAt: null }}
            x={hover.x}
            y={hover.y}
          />,
          document.body,
        )}
    </div>
  )
}
