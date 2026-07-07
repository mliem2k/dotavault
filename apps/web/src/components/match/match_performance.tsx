import type { HeroStat, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { PlayerNameLink, TeamHeader, orderedTeams } from './match_roster'

/* Performance tab - lanes, efficiency, APM, teamfight participation, stuns,
   camps, runes, buybacks, and per-metric benchmark percentiles. */

const C = {
  label: '#8a97a0',
  dim: '#8a8474',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#8fbf3f',
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

/* Largest key of a count map (e.g. multi_kills {"2":5,"3":3} → 3). */
function maxKey(rec: Record<string, number> | null | undefined): number | null {
  const keys = Object.keys(rec ?? {}).map(Number).filter(Number.isFinite)
  return keys.length ? Math.max(...keys) : null
}

// Lane is a categorical position (Safe/Mid/Off/Jungle), not a scalar — there's
// no natural "greater than" order between them, so it's left unsortable. All
// other columns are discrete numbers and get a shared sort control.
type SortKey = 'lane_eff' | 'apm' | 'tfp' | 'stuns' | 'camps' | 'runes' | 'bb' | 'multi' | 'streak' | 'pings'

function comparePerf(sortKey: SortKey) {
  return (a: MatchPlayer, b: MatchPlayer): number => {
    switch (sortKey) {
      case 'apm':
        return (a.actions_per_min ?? 0) - (b.actions_per_min ?? 0)
      case 'tfp':
        return (a.teamfight_participation ?? 0) - (b.teamfight_participation ?? 0)
      case 'stuns':
        return (a.stuns ?? 0) - (b.stuns ?? 0)
      case 'camps':
        return (a.camps_stacked ?? 0) - (b.camps_stacked ?? 0)
      case 'runes':
        return (a.rune_pickups ?? 0) - (b.rune_pickups ?? 0)
      case 'bb':
        return (a.buyback_count ?? 0) - (b.buyback_count ?? 0)
      case 'multi':
        return (maxKey(a.multi_kills) ?? 0) - (maxKey(b.multi_kills) ?? 0)
      case 'streak':
        return (maxKey(a.kill_streaks) ?? 0) - (maxKey(b.kill_streaks) ?? 0)
      case 'pings':
        return (a.pings ?? 0) - (b.pings ?? 0)
      default:
        return (a.lane_efficiency_pct ?? 0) - (b.lane_efficiency_pct ?? 0)
    }
  }
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
          <a href={`/hero/${heroSlug(hero.localized_name)}`} className="shrink-0 block">
            <img
              src={heroIconUrl(hero.name)}
              alt=""
              loading="lazy"
              style={{ width: 44, height: 44 }}
              onError={(e) => {
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(hero.icon)
              }}
            />
          </a>
        )}
        <div className="min-w-0" style={{ fontFamily: 'var(--font-dota)' }}>
          {hero ? (
            <a href={`/hero/${heroSlug(hero.localized_name)}`} className="block text-[15px] truncate hover:underline" style={{ color: C.white }}>
              {hero.localized_name}
            </a>
          ) : (
            <div className="text-[15px] truncate" style={{ color: C.white }} />
          )}
          <PlayerNameLink player={p} className="block text-[12px] truncate" style={{ color: C.dim }} />
        </div>
      </div>
      {cell(p.lane_role ? LANES[p.lane_role] ?? '-' : '-', 84)}
      {cell(eff != null ? `${eff}%` : '-', 84, eff != null ? pctColor(eff / 100) : C.dim)}
      {cell(p.actions_per_min ?? '-', 84)}
      {cell(tfp != null ? `${Math.round(tfp * 100)}%` : '-', 84)}
      {cell(p.stuns != null ? p.stuns.toFixed(1) : '-', 84)}
      {cell(p.camps_stacked ?? '-', 84)}
      {cell(p.rune_pickups ?? '-', 84)}
      {cell(p.buyback_count ?? '-', 70)}
      {cell(maxKey(p.multi_kills) != null ? `${maxKey(p.multi_kills)}x` : '-', 70)}
      {cell(maxKey(p.kill_streaks) ?? '-', 70)}
      {cell(p.pings ?? '-', 70)}
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
                  {pct != null ? `${Math.round(pct * 100)}` : '-'}
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
  // One shared sort control drives both team sections independently — each
  // team's 5 rows are sorted on their own, never merged into one list of 10.
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('lane_eff', 'desc')
  const radiantSorted = applySort(radiant, sortDir, comparePerf(sortKey))
  const direSorted = applySort(dire, sortDir, comparePerf(sortKey))

  const header = (
    <div
      className="flex items-center py-2 text-[13px] uppercase"
      style={{ color: C.label, letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
    >
      <div className="shrink-0" style={{ width: 240 }} />
      <div className="shrink-0 text-center" style={{ width: 84 }}>
        Lane
      </div>
      <SortHeader label="Lane Eff" sortKey="lane_eff" active={sortKey === 'lane_eff'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="APM" sortKey="apm" active={sortKey === 'apm'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="TF Part" sortKey="tfp" active={sortKey === 'tfp'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="Stuns" sortKey="stuns" active={sortKey === 'stuns'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="Camps" sortKey="camps" active={sortKey === 'camps'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="Runes" sortKey="runes" active={sortKey === 'runes'} dir={sortDir} onClick={onSort} className="w-[84px] shrink-0 justify-center" />
      <SortHeader label="BB" sortKey="bb" active={sortKey === 'bb'} dir={sortDir} onClick={onSort} className="w-[70px] shrink-0 justify-center" />
      <SortHeader label="Multi" sortKey="multi" active={sortKey === 'multi'} dir={sortDir} onClick={onSort} className="w-[70px] shrink-0 justify-center" />
      <SortHeader label="Streak" sortKey="streak" active={sortKey === 'streak'} dir={sortDir} onClick={onSort} className="w-[70px] shrink-0 justify-center" />
      <SortHeader label="Pings" sortKey="pings" active={sortKey === 'pings'} dir={sortDir} onClick={onSort} className="w-[70px] shrink-0 justify-center" />
      <div className="pl-4">
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
      <div style={{ background: C.panel, minWidth: 1510 }}>
        {section(radiantSorted, true)}
        {section(direSorted, false)}
      </div>
    </div>
  )
}
