import type { HeroStat, Match, MatchPlayer } from 'types'
import { playerColor } from '@/lib/dotaconst'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

/* Fantasy tab: fantasy points per player using the standard OpenDota
   scoring (same components Dota's official fantasy leagues use). */

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

type Component = { label: string; value: (p: MatchPlayer) => number; points: (p: MatchPlayer) => number }

const COMPONENTS: Component[] = [
  { label: 'Kills', value: (p) => p.kills, points: (p) => p.kills * 0.3 },
  { label: 'Deaths', value: (p) => p.deaths, points: (p) => 3 - p.deaths * 0.3 },
  { label: 'CS', value: (p) => p.last_hits + p.denies, points: (p) => (p.last_hits + p.denies) * 0.003 },
  { label: 'GPM', value: (p) => p.gold_per_min, points: (p) => p.gold_per_min * 0.002 },
  { label: 'Towers', value: (p) => p.towers_killed ?? 0, points: (p) => (p.towers_killed ?? 0) * 1 },
  { label: 'Roshan', value: (p) => p.roshans_killed ?? 0, points: (p) => (p.roshans_killed ?? 0) * 1 },
  {
    label: 'Teamfight',
    value: (p) => Math.round((p.teamfight_participation ?? 0) * 100),
    points: (p) => (p.teamfight_participation ?? 0) * 3,
  },
  { label: 'Obs Wards', value: (p) => p.obs_placed ?? 0, points: (p) => (p.obs_placed ?? 0) * 0.5 },
  { label: 'Stacks', value: (p) => p.camps_stacked ?? 0, points: (p) => (p.camps_stacked ?? 0) * 0.5 },
  { label: 'Runes', value: (p) => p.rune_pickups ?? 0, points: (p) => (p.rune_pickups ?? 0) * 0.25 },
  { label: 'First Blood', value: (p) => p.firstblood_claimed ?? 0, points: (p) => (p.firstblood_claimed ?? 0) * 4 },
  { label: 'Stuns', value: (p) => Math.round(p.stuns ?? 0), points: (p) => (p.stuns ?? 0) * 0.05 },
]

const totalPoints = (p: MatchPlayer) => COMPONENTS.reduce((s, c) => s + c.points(p), 0)

export function MatchFantasy({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const best = Math.max(...match.players.map(totalPoints))

  const row = (p: MatchPlayer) => {
    const hero = heroMap.get(p.hero_id)
    const total = totalPoints(p)
    return (
      <tr key={p.player_slot} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span style={{ width: 3, height: 22, background: playerColor(p.player_slot) }} />
            <img
              src={hero ? heroIconUrl(hero.name) : ''}
              alt=""
              title={hero?.localized_name}
              style={{ width: 26, height: 26 }}
              onError={(e) => {
                if (!hero) return
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(hero.icon)
              }}
            />
            <span className="max-w-[130px] truncate text-[13px]" style={{ color: p.player_slot < 128 ? C.green : C.red }}>
              {p.personaname ?? 'Anonymous'}
            </span>
          </div>
        </td>
        <td className="px-2 text-right">
          <span
            className="text-[15px] font-bold tabular-nums"
            style={{ color: total === best ? C.gold : C.white }}
            title={total === best ? 'Best fantasy score of the match' : undefined}
          >
            {total.toFixed(1)}
          </span>
        </td>
        {COMPONENTS.map((c) => {
          const pts = c.points(p)
          return (
            <td key={c.label} className="px-2 text-center">
              <div className="text-[13px] tabular-nums" style={{ color: pts > 0 ? C.text : '#3a4147' }}>
                {pts.toFixed(1)}
              </div>
              <div className="text-[11px] tabular-nums" style={{ color: C.dim }}>{c.value(p)}</div>
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto" style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
      <div className="px-4 py-3 text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}>
        Fantasy Points
      </div>
      <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
        <thead>
          <tr className="text-[12px] uppercase" style={{ color: C.dim, letterSpacing: '1px' }}>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-2 text-right">Total</th>
            {COMPONENTS.map((c) => (
              <th key={c.label} className="px-2 text-center">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {match.players.filter((p) => p.player_slot < 128).map(row)}
          <tr>
            <td colSpan={2 + COMPONENTS.length} style={{ height: 10 }} />
          </tr>
          {match.players.filter((p) => p.player_slot >= 128).map(row)}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[12px]" style={{ color: C.dim }}>
        Standard fantasy scoring: 0.3/kill, 3 minus 0.3/death, 0.003/CS, 0.002/GPM, 1/tower, 1/Roshan, 3 x teamfight
        share, 0.5/observer, 0.5/stack, 0.25/rune, 4/first blood, 0.05/stun second. Small values show points over raw
        stat.
      </p>
    </div>
  )
}
