import type { HeroStat, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { PlayerNameLink, TeamHeader, orderedTeams } from './match_roster'

/* Performance tab — lanes, efficiency, APM, teamfight participation, stuns,
   camps, runes, buybacks, and per-metric benchmark percentiles. */

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

const LANES: Record<number, string> = { 1: 'Safe', 2: 'Mid', 3: 'Off', 4: 'Jungle' }

const BENCH_KEYS: { key: string; label: string }[] = [
  { key: 'gold_per_min', label: 'GPM' },
  { key: 'xp_per_min', label: 'XPM' },
  { key: 'kills_per_min', label: 'K/min' },
  { key: 'last_hits_per_min', label: 'LH/min' },
  { key: 'hero_damage_per_min', label: 'DMG/min' },
]

function pctColor(p: number): string {
  if (p >= 0.75) return C.green
  if (p >= 0.4) return C.gold
  return C.red
}

function Row({ p, hero }: { p: MatchPlayer; hero: HeroStat | undefined }) {
  const eff = p.lane_efficiency_pct
  const tfp = p.teamfight_participation
  const cell = (v: React.ReactNode, w: number, color = C.text) => (
    <div className="shrink-0 flex items-center justify-center text-[16px] tabular-nums" style={{ width: w, color, fontFamily: 'var(--font-dota)' }}>
      {v}
    </div>
  )
  return (
    <div className="flex items-center" style={{ height: 66, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-2.5 shrink-0 px-3" style={{ width: 240 }}>
        {hero && (
          <img
            src={heroIconUrl(hero.name)}
            alt=""
            style={{ width: 44, height: 44 }}
            onError={(e) => {
              const img = e.currentTarget
              img.onerror = null
              img.src = heroIconFromPath(hero.icon)
            }}
          />
        )}
        <div className="min-w-0" style={{ fontFamily: 'var(--font-dota)' }}>
          <div className="text-[15px] truncate" style={{ color: C.white }}>{hero?.localized_name}</div>
          <PlayerNameLink player={p} className="block text-[12px] truncate" style={{ color: C.dim }} />
        </div>
      </div>
      {cell(p.lane_role ? LANES[p.lane_role] ?? '—' : '—', 84)}
      {cell(eff != null ? `${eff}%` : '—', 84, eff != null ? pctColor(eff / 100) : C.dim)}
      {cell(p.actions_per_min ?? '—', 84)}
      {cell(tfp != null ? `${Math.round(tfp * 100)}%` : '—', 84)}
      {cell(p.stuns != null ? p.stuns.toFixed(1) : '—', 84)}
      {cell(p.camps_stacked ?? '—', 84)}
      {cell(p.rune_pickups ?? '—', 84)}
      {cell(p.buyback_count ?? '—', 70)}
      {/* benchmark percentile bars */}
      <div className="flex items-center gap-4 pl-4">
        {BENCH_KEYS.map(({ key, label }) => {
          const b = (p.benchmarks as Record<string, { raw?: number; pct?: number }> | null)?.[key]
          const pct = typeof b?.pct === 'number' ? b.pct : null
          return (
            <div key={key} className="w-[96px]" title={pct != null ? `${label}: better than ${Math.round(pct * 100)}% of players` : label}>
              <div className="flex justify-between text-[11px] uppercase" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
                <span>{label}</span>
                <span className="tabular-nums" style={{ color: pct != null ? pctColor(pct) : C.dim }}>
                  {pct != null ? `${Math.round(pct * 100)}` : '—'}
                </span>
              </div>
              <div style={{ height: 6, background: '#2c3236', marginTop: 2 }}>
                {pct != null && <div style={{ height: '100%', width: `${pct * 100}%`, background: pctColor(pct) }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MatchPerformance({
  match,
  heroStats,
}: {
  match: Match
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)

  const header = (
    <div className="flex items-center" style={{ height: 40 }}>
      <div className="shrink-0" style={{ width: 240 }} />
      {['Lane', 'Lane Eff', 'APM', 'TF Part', 'Stuns', 'Camps', 'Runes', 'BB'].map((l, i) => (
        <div
          key={l}
          className="shrink-0 text-center text-[13px] uppercase"
          style={{ width: i === 7 ? 70 : 84, color: C.label, letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
        >
          {l}
        </div>
      ))}
      <div className="pl-4 text-[13px] uppercase" style={{ color: C.label, letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}>
        Benchmarks (percentile vs all players on this hero)
      </div>
    </div>
  )

  const section = (players: MatchPlayer[], isRadiant: boolean) => (
    <div>
      <TeamHeader
        isRadiant={isRadiant}
        score={isRadiant ? match.radiant_score : match.dire_score}
        isWinner={isRadiant ? match.radiant_win : !match.radiant_win}
        width={280}
        headerH={52}
      />
      {header}
      {players.map((p) => (
        <Row key={p.player_slot} p={p} hero={heroMap.get(p.hero_id)} />
      ))}
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <div style={{ background: C.panel, minWidth: 1300 }}>
        {section(radiant, true)}
        {section(dire, false)}
      </div>
    </div>
  )
}
