import type { HeroStat, Match, Objective } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

/* Objectives tab — chronological timeline of firstblood, towers, barracks,
   Roshan, Aegis, and courier events. */

const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
}

function fmtClock(sec: number): string {
  const neg = sec < 0
  const a = Math.abs(Math.floor(sec))
  return `${neg ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

const TOWER_NAMES: Record<string, string> = {
  tower1_top: 'Top T1', tower2_top: 'Top T2', tower3_top: 'Top T3',
  tower1_mid: 'Mid T1', tower2_mid: 'Mid T2', tower3_mid: 'Mid T3',
  tower1_bot: 'Bot T1', tower2_bot: 'Bot T2', tower3_bot: 'Bot T3',
  tower4: 'T4',
  melee_rax_top: 'Top Melee Rax', range_rax_top: 'Top Ranged Rax',
  melee_rax_mid: 'Mid Melee Rax', range_rax_mid: 'Mid Ranged Rax',
  melee_rax_bot: 'Bot Melee Rax', range_rax_bot: 'Bot Ranged Rax',
  fort: 'Ancient',
}

function buildingLabel(key: string): { team: 'radiant' | 'dire'; label: string } | null {
  const owner = key.includes('goodguys') ? 'radiant' : key.includes('badguys') ? 'dire' : null
  if (!owner) return null
  const suffix = key.replace(/npc_dota_(goodguys|badguys)_/, '')
  const label = TOWER_NAMES[suffix] ?? suffix.replace(/_/g, ' ')
  return { team: owner, label }
}

export type ObjectiveEvent = { time: number; icon: string; text: string; team: 'radiant' | 'dire' | null; heroId?: number }

// Shared by the Objectives tab and the replay viewer's event feed.
export function extractObjectiveEvents(match: Match, heroStats: HeroStat[]): ObjectiveEvent[] {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const bySlot = new Map(match.players.map((p) => [p.player_slot, p]))
  const heroName = (playerSlot: number | null | undefined) => {
    const p = playerSlot != null ? bySlot.get(playerSlot) : undefined
    return p ? heroMap.get(p.hero_id) : undefined
  }

  const events: ObjectiveEvent[] = []
  for (const o of (match.objectives ?? []) as Objective[]) {
    switch (o.type) {
      case 'CHAT_MESSAGE_FIRSTBLOOD': {
        const hero = heroName(o.player_slot)
        events.push({
          time: o.time,
          icon: '🩸',
          text: `First Blood drawn by ${hero?.localized_name ?? 'unknown'}`,
          team: o.player_slot != null && o.player_slot < 128 ? 'radiant' : 'dire',
          heroId: hero?.id,
        })
        break
      }
      case 'building_kill': {
        const b = o.key ? buildingLabel(o.key) : null
        if (!b) break
        // the destroyed building's owner LOSES it; credit the other team
        const credit = b.team === 'radiant' ? 'dire' : 'radiant'
        events.push({
          time: o.time,
          icon: b.label.includes('Rax') ? '🏛' : b.label === 'Ancient' ? '👑' : '🗼',
          text: `${b.team === 'radiant' ? 'Radiant' : 'Dire'} ${b.label} destroyed`,
          team: credit,
        })
        break
      }
      case 'CHAT_MESSAGE_ROSHAN_KILL': {
        events.push({
          time: o.time,
          icon: '🐗',
          text: `Roshan slain by ${o.team === 2 ? 'Radiant' : 'Dire'}`,
          team: o.team === 2 ? 'radiant' : 'dire',
        })
        break
      }
      case 'CHAT_MESSAGE_AEGIS': {
        const hero = heroName(o.player_slot)
        events.push({
          time: o.time,
          icon: '🛡',
          text: `Aegis picked up by ${hero?.localized_name ?? 'unknown'}`,
          team: o.player_slot != null && o.player_slot < 128 ? 'radiant' : 'dire',
          heroId: hero?.id,
        })
        break
      }
      case 'CHAT_MESSAGE_COURIER_LOST': {
        events.push({
          time: o.time,
          icon: '🐴',
          text: `${o.team === 2 ? 'Radiant' : 'Dire'} courier killed`,
          team: o.team === 2 ? 'dire' : 'radiant',
        })
        break
      }
      default:
        break
    }
  }
  events.sort((a, b) => a.time - b.time)
  return events
}

export function MatchObjectives({
  match,
  heroStats,
}: {
  match: Match
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const events = extractObjectiveEvents(match, heroStats)

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-slate-muted font-dota">
          This match is unparsed — objective data unavailable.
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-[900px] mx-auto" style={{ background: C.panel }}>
      <div
        className="text-[15px] uppercase px-4 py-3 text-white font-dota"
        style={{ letterSpacing: '2px', background: 'rgba(8,10,12,0.7)' }}
      >
        Objectives
      </div>
      <div className="p-4">
        {events.map((e, i) => {
          const hero = e.heroId != null ? heroMap.get(e.heroId) : undefined
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static event list
            <div key={i} className="flex items-center gap-3.5 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="w-14 text-right text-[15px] tabular-nums shrink-0 text-slate-muted font-dota">
                {fmtClock(e.time)}
              </span>
              <span className={e.team === 'radiant' ? 'bg-radiant' : e.team === 'dire' ? 'bg-dire' : 'bg-slate-border'} style={{ width: 3, height: 26 }} />
              <span className="text-[19px] w-7 text-center">{e.icon}</span>
              {hero && (
                <img
                  src={heroIconUrl(hero.name)}
                  alt=""
                  style={{ width: 32, height: 32 }}
                  onError={(ev) => {
                    const img = ev.currentTarget
                    img.onerror = null
                    img.src = heroIconFromPath(hero.icon)
                  }}
                />
              )}
              <span className="text-[16px] text-slate-foreground font-dota">{e.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
