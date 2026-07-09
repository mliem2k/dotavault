import type { HeroStat, Match, MatchPlayer } from 'types'
import { SortHeader } from '@/components/ui/sort_header'
import { applySort, useSort } from '@/lib/sortable'
import { heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { TeamHeader, orderedTeams } from './match_roster'

/* Farm tab — where each player's gold came from (OpenDota gold_reasons),
   gold spent, and farming milestones. */

const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
}

// OpenDota gold_reasons ids → label + bar color.
const GOLD_REASONS: { id: string; label: string; color: string }[] = [
  { id: '13', label: 'Lane Creeps', color: '#c9a94a' },
  { id: '14', label: 'Neutrals', color: '#8a6d2f' },
  { id: '12', label: 'Heroes', color: '#c94a38' },
  { id: '11', label: 'Buildings', color: '#5a8fc2' },
  { id: '15', label: 'Roshan', color: '#9a5fc2' },
  { id: '17', label: 'Bounty Runes', color: '#4aa96c' },
  { id: '16', label: 'Couriers', color: '#c27a4a' },
  { id: '19', label: 'Wards', color: '#4ac2b4' },
  { id: '6', label: 'Selling', color: '#7a8a99' },
  { id: '0', label: 'Passive', color: '#5c666c' },
]

type SortKey = 'earned' | 'spent' | 'lh10' | 'dn'

function earnedGold(p: MatchPlayer): number {
  return p.total_gold ?? p.net_worth
}

function lhAt10(p: MatchPlayer): number | null {
  return p.lh_t && p.lh_t.length > 10 ? p.lh_t[10] : null
}

function compareFarm(sortKey: SortKey) {
  return (a: MatchPlayer, b: MatchPlayer): number => {
    switch (sortKey) {
      case 'spent':
        return (a.gold_spent ?? 0) - (b.gold_spent ?? 0)
      case 'lh10':
        return (lhAt10(a) ?? 0) - (lhAt10(b) ?? 0)
      case 'dn':
        return (a.denies ?? 0) - (b.denies ?? 0)
      default:
        return earnedGold(a) - earnedGold(b)
    }
  }
}

function GoldBar({ p }: { p: MatchPlayer }) {
  const reasons = p.gold_reasons ?? {}
  const parts = GOLD_REASONS.map((r) => ({ ...r, value: Math.max(0, reasons[r.id] ?? 0) }))
  const total = parts.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <span className="text-[14px] text-slate-muted">—</span>
  return (
    <div className="flex h-[20px] w-full overflow-hidden" title={parts.filter((x) => x.value > 0).map((x) => `${x.label}: ${x.value.toLocaleString()}`).join('\n')}>
      {parts.map(
        (x) =>
          x.value > 0 && (
            <div key={x.id} style={{ width: `${(x.value / total) * 100}%`, background: x.color }} />
          ),
      )}
    </div>
  )
}

export function MatchFarm({
  match,
  heroStats,
}: {
  match: Match
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)
  const maxEarned = Math.max(1, ...match.players.map((p) => p.total_gold ?? p.net_worth))
  // One shared sort control drives both team sections independently — each
  // team's 5 rows are sorted on their own, never merged into one list of 10.
  const { key: sortKey, dir: sortDir, onSort } = useSort<SortKey>('earned', 'desc')
  const radiantSorted = applySort(radiant, sortDir, compareFarm(sortKey))
  const direSorted = applySort(dire, sortDir, compareFarm(sortKey))

  const header = (
    <div
      className="flex items-center px-2 py-2 text-[13px] uppercase text-slate-muted-light font-dota"
      style={{ letterSpacing: '1px' }}
    >
      <div className="shrink-0" style={{ width: 240 }} />
      <div className="flex-1">Gold Sources</div>
      <SortHeader label="Earned" sortKey="earned" active={sortKey === 'earned'} dir={sortDir} onClick={onSort} className="w-[100px] shrink-0 justify-end pr-2" />
      <SortHeader label="Spent" sortKey="spent" active={sortKey === 'spent'} dir={sortDir} onClick={onSort} className="w-[100px] shrink-0 justify-end pr-2" />
      <SortHeader label="LH @10" sortKey="lh10" active={sortKey === 'lh10'} dir={sortDir} onClick={onSort} className="w-[100px] shrink-0 justify-end pr-2" />
      <SortHeader label="DN" sortKey="dn" active={sortKey === 'dn'} dir={sortDir} onClick={onSort} className="w-[100px] shrink-0 justify-end pr-2" />
    </div>
  )

  const row = (p: MatchPlayer) => {
    const hero = heroMap.get(p.hero_id)
    const earned = earnedGold(p)
    const lh10 = lhAt10(p)
    return (
      <div key={p.player_slot} className="flex items-center px-2" style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2.5 shrink-0" style={{ width: 240 }}>
          {hero && (
            <a href={`/hero/${heroSlug(hero.localized_name)}`} className="shrink-0 block">
              <img
                src={heroIconUrl(hero.name)}
                alt=""
                style={{ width: 42, height: 42 }}
                onError={(e) => {
                  const img = e.currentTarget
                  img.onerror = null
                  img.src = heroIconFromPath(hero.icon)
                }}
              />
            </a>
          )}
          <div className="min-w-0 font-dota">
            {hero ? (
              <a
                href={`/hero/${heroSlug(hero.localized_name)}`}
                className="block text-[15px] truncate hover:underline text-white"
              >
                {hero.localized_name}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex-1 pr-4" style={{ maxWidth: `${(earned / maxEarned) * 100}%`, minWidth: 60 }}>
          <GoldBar p={p} />
        </div>
        <div className="flex-none ml-auto flex">
          <div className="w-[100px] text-right text-[16px] tabular-nums pr-2 text-gold font-dota">
            {earned.toLocaleString()}
          </div>
          <div className="w-[100px] text-right text-[16px] tabular-nums pr-2 text-slate-foreground font-dota">
            {p.gold_spent?.toLocaleString() ?? '—'}
          </div>
          <div className="w-[100px] text-right text-[16px] tabular-nums pr-2 text-slate-foreground font-dota">
            {lh10 ?? '—'}
          </div>
          <div className="w-[100px] text-right text-[16px] tabular-nums pr-2 text-slate-foreground font-dota">
            {p.denies}
          </div>
        </div>
      </div>
    )
  }

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
      {players.map(row)}
    </div>
  )

  return (
    <div className="space-y-3">
      <div style={{ background: C.panel }}>
        {section(radiantSorted, true)}
        {section(direSorted, false)}
      </div>
      {/* legend */}
      <div className="flex items-center gap-5 flex-wrap px-1 pt-1">
        {GOLD_REASONS.map((r) => (
          <span key={r.id} className="flex items-center gap-2 text-[13px] uppercase text-slate-muted-light font-dota" style={{ letterSpacing: '1px' }}>
            <span style={{ width: 13, height: 13, background: r.color, display: 'inline-block' }} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}
