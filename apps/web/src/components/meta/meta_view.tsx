import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { HeroStat } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { SortHeader } from '@/components/ui/sort_header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { opendota } from '@/lib/opendota'
import { RANK_NAMES } from '@/lib/rank'
import { applySort, useSort } from '@/lib/sortable'
import { usePageTitle } from '@/lib/title'
import { heroIconUrl, heroSlug } from '@/lib/utils'

/* Meta page: pick, win, and (for pro) ban rates for every hero, filterable
   by rank bracket, Turbo, and professional Captains Mode, with per-lane
   leaders on top. Data is OpenDota heroStats (this month's matches). */

type Bracket = 'pub' | '1' | '2' | '3' | '4' | '5' | '6' | '78' | 'turbo' | 'pro'

const BRACKETS: { key: Bracket; label: string; medal?: number }[] = [
  { key: 'pub', label: 'All Ranks' },
  { key: '1', label: RANK_NAMES[1], medal: 1 },
  { key: '2', label: RANK_NAMES[2], medal: 2 },
  { key: '3', label: RANK_NAMES[3], medal: 3 },
  { key: '4', label: RANK_NAMES[4], medal: 4 },
  { key: '5', label: RANK_NAMES[5], medal: 5 },
  { key: '6', label: RANK_NAMES[6], medal: 6 },
  { key: '78', label: `${RANK_NAMES[7]} / ${RANK_NAMES[8]}`, medal: 8 },
  { key: 'turbo', label: 'Turbo' },
  { key: 'pro', label: 'Pro' },
]

const raw = (h: HeroStat, key: string): number => (h as unknown as Record<string, number>)[key] ?? 0

/* OpenDota has no separate Immortal bracket (8_pick is zero for every
   hero); Divine and Immortal are one bucket, matching their own site. */
function picksOf(h: HeroStat, b: Bracket): number {
  if (b === 'pub') return raw(h, 'pub_pick')
  if (b === 'turbo') return h.turbo_picks ?? 0
  if (b === 'pro') return h.pro_pick ?? 0
  if (b === '78') return raw(h, '7_pick') + raw(h, '8_pick')
  return raw(h, `${b}_pick`)
}

function winsOf(h: HeroStat, b: Bracket): number {
  if (b === 'pub') return raw(h, 'pub_win')
  if (b === 'turbo') return h.turbo_wins ?? 0
  if (b === 'pro') return h.pro_win ?? 0
  if (b === '78') return raw(h, '7_win') + raw(h, '8_win')
  return raw(h, `${b}_win`)
}

/* Win-rate trend from OpenDota's daily trend arrays (pub and turbo only):
   recent half of the window versus the earlier half, in percentage points. */
function trendDelta(h: HeroStat, b: Bracket): number | null {
  const picksKey = b === 'pub' ? 'pub_pick_trend' : b === 'turbo' ? 'turbo_picks_trend' : null
  const winsKey = b === 'pub' ? 'pub_win_trend' : b === 'turbo' ? 'turbo_wins_trend' : null
  if (!picksKey || !winsKey) return null
  const picks = (h as unknown as Record<string, number[]>)[picksKey]
  const wins = (h as unknown as Record<string, number[]>)[winsKey]
  if (!Array.isArray(picks) || !Array.isArray(wins) || picks.length < 4) return null
  const half = Math.floor(picks.length / 2)
  const wr = (ps: number[], ws: number[]) => {
    const p = ps.reduce((s, v) => s + v, 0)
    return p > 0 ? (ws.reduce((s, v) => s + v, 0) / p) * 100 : null
  }
  const early = wr(picks.slice(0, half), wins.slice(0, half))
  const late = wr(picks.slice(half), wins.slice(half))
  if (early == null || late == null) return null
  return late - early
}

const winPct = (h: HeroStat, b: Bracket): number => {
  const p = picksOf(h, b)
  return p > 0 ? (winsOf(h, b) / p) * 100 : 0
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
      <div
        className="px-4 py-3 uppercase text-foreground font-display border-b border-border"
        style={{
          background: 'rgba(8,10,12,0.85)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
        }}
      >
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

const LANES = [
  { pos: 1, label: 'Safe Lane', colorClass: 'text-radiant', filter: (h: HeroStat) => h.roles.includes('Carry') },
  {
    pos: 2,
    label: 'Mid Lane',
    colorClass: 'text-int',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      (h.roles.includes('Nuker') || h.primary_attr === 'int'),
  },
  {
    pos: 3,
    label: 'Off Lane',
    color: '#c97a3a',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      (h.roles.includes('Initiator') || h.roles.includes('Durable')),
  },
  {
    pos: 4,
    label: 'Soft Support',
    colorClass: 'text-uni',
    filter: (h: HeroStat) => h.roles.includes('Support') && !h.roles.includes('Disabler'),
  },
  {
    pos: 5,
    label: 'Hard Support',
    color: '#d94a8a',
    filter: (h: HeroStat) => h.roles.includes('Support') && h.roles.includes('Disabler'),
  },
]

// Rankings need a sample floor or 1-pick 100% heroes dominate every list.
const minPicks = (b: Bracket): number => (b === 'pro' ? 10 : 100)

function LaneCard({ lane, heroes, bracket }: { lane: (typeof LANES)[0]; heroes: HeroStat[]; bracket: Bracket }) {
  const top = useMemo(
    () =>
      [...heroes]
        .filter(lane.filter)
        .filter((h) => picksOf(h, bracket) >= minPicks(bracket))
        .sort((a, b) => winPct(b, bracket) - winPct(a, bracket))
        .slice(0, 8),
    [heroes, lane, bracket],
  )

  return (
    <Panel title={lane.label}>
      <div
        className={`mb-3 text-[12px] font-bold uppercase tracking-widest font-dota ${lane.colorClass ?? ''}`}
        style={lane.colorClass ? undefined : { color: lane.color }}
      >
        Position {lane.pos}
      </div>
      <div>
        {top.map((h, i) => {
          const picks = picksOf(h, bracket)
          const wrPct = winPct(h, bracket)
          return (
            <a
              key={h.id}
              href={`/hero/${heroSlug(h.localized_name)}`}
              className={`flex items-center gap-2 py-1.5 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
            >
              <span className="w-4 text-right tabular-nums text-[12px] text-muted font-dota">
                {i + 1}
              </span>
              <img
                src={heroIconUrl(h.name)}
                alt={h.localized_name}
                loading="lazy"
                className="h-6 w-6 rounded-sm shrink-0"
              />
              <span className="flex-1 text-[14px] truncate text-foreground font-dota">
                {h.localized_name}
              </span>
              <span
                className={`text-[13px] font-semibold tabular-nums font-dota ${
                  wrPct >= 52 ? 'text-radiant' : wrPct < 48 ? 'text-dire' : 'text-foreground'
                }`}
              >
                {wrPct.toFixed(1)}%
              </span>
              <span className="w-14 text-right text-[12px] tabular-nums text-muted font-dota">
                {picks.toLocaleString()}
              </span>
            </a>
          )
        })}
      </div>
    </Panel>
  )
}

const ATTRS = [
  { key: 'all', label: 'Any Attribute' },
  { key: 'str', label: 'Strength' },
  { key: 'agi', label: 'Agility' },
  { key: 'int', label: 'Intelligence' },
  { key: 'universal', label: 'Universal' },
] as const

type SortKey = 'name' | 'picks' | 'pickrate' | 'winrate' | 'banrate'

function HeroTable({ heroes, bracket }: { heroes: HeroStat[]; bracket: Bracket }) {
  const [search, setSearch] = useState('')
  const [attr, setAttr] = useState<(typeof ATTRS)[number]['key']>('all')
  const { key, dir, onSort } = useSort<SortKey>('winrate')

  // A hero appears once per match, a match has 10 picks.
  const totalMatches = heroes.reduce((s, h) => s + picksOf(h, bracket), 0) / 10
  const totalProMatchesForBans = bracket === 'pro' ? Math.max(1, totalMatches) : 1

  const rows = useMemo(() => {
    let list = heroes.filter((h) => picksOf(h, bracket) > 0)
    if (attr !== 'all') {
      list = list.filter((h) => (attr === 'universal' ? h.primary_attr === 'all' : h.primary_attr === attr))
    }
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((h) => h.localized_name.toLowerCase().includes(q))

    const cmp: Record<SortKey, (a: HeroStat, b: HeroStat) => number> = {
      name: (a, b) => b.localized_name.localeCompare(a.localized_name),
      picks: (a, b) => picksOf(a, bracket) - picksOf(b, bracket),
      pickrate: (a, b) => picksOf(a, bracket) - picksOf(b, bracket),
      winrate: (a, b) => winPct(a, bracket) - winPct(b, bracket),
      banrate: (a, b) => (a.pro_ban ?? 0) - (b.pro_ban ?? 0),
    }
    return applySort(list, dir, cmp[key])
  }, [heroes, bracket, attr, search, key, dir])

  const th = (label: string, k: SortKey, align: 'left' | 'right' = 'right') => {
    const active = key === k
    const ariaSort: 'ascending' | 'descending' | 'none' = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th aria-sort={ariaSort} className={`pb-2 ${align === 'left' ? 'text-left' : 'text-right'} px-2`}>
        <SortHeader label={label} sortKey={k} active={active} dir={dir} onClick={(sk) => onSort(sk as SortKey)} />
      </th>
    )
  }

  return (
    <Panel title={`Hero Win Rates: ${BRACKETS.find((b) => b.key === bracket)?.label ?? ''}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hero..."
          aria-label="Search heroes"
          className="px-3 py-1.5 text-[13px] border border-border text-foreground font-dota focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
          style={{
            background: 'rgba(8,10,12,0.7)',
            width: 200,
          }}
        />
        <Tabs value={attr} onValueChange={(v) => setAttr(v as (typeof ATTRS)[number]['key'])}>
          <TabsList className="h-auto rounded-none border border-border bg-transparent p-0">
            {ATTRS.map((a) => (
              <TabsTrigger
                key={a.key}
                value={a.key}
                className="min-h-11 flex-none rounded-none px-2.5 py-1.5 text-[12px] uppercase tracking-[1px] font-dota text-muted cursor-pointer data-[state=active]:bg-border data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="ml-auto text-[12px] text-muted font-dota">
          {rows.length} heroes
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-dota">
          <thead>
            <tr className="text-[12px] font-bold uppercase tracking-widest text-muted">
              <th className="pb-2 pr-2 text-right" style={{ width: 30 }}>#</th>
              {th('Hero', 'name', 'left')}
              <th className="pb-2 px-2 text-left">Attr</th>
              {th('Picks', 'picks')}
              {th('Pick Rate', 'pickrate')}
              {th('Win Rate', 'winrate')}
              {(bracket === 'pub' || bracket === 'turbo') && <th className="pb-2 px-2 text-right">Trend</th>}
              {bracket === 'pro' && th('Bans', 'banrate')}
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => {
              const picks = picksOf(h, bracket)
              const wr = winPct(h, bracket)
              const pickRate = totalMatches > 0 ? (picks / totalMatches) * 100 : 0
              return (
                <tr key={h.id} className="hover:bg-white/[0.03] border-t border-border">
                  <td className="py-1.5 pr-2 text-right text-[12px] tabular-nums text-muted">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <a href={`/hero/${heroSlug(h.localized_name)}`} className="flex items-center gap-2 hover:underline">
                      <img src={heroIconUrl(h.name)} alt="" loading="lazy" className="h-6 w-6 rounded-sm" />
                      <span className="text-[14px] text-foreground">{h.localized_name}</span>
                    </a>
                  </td>
                  <td className="px-2 text-[12px] uppercase text-muted">
                    {h.primary_attr === 'all' ? 'uni' : h.primary_attr}
                  </td>
                  <td className="px-2 text-right text-[13px] tabular-nums text-foreground">
                    {picks.toLocaleString()}
                  </td>
                  <td className="px-2 text-right text-[13px] tabular-nums text-gold">
                    {pickRate.toFixed(1)}%
                  </td>
                  <td
                    className={`px-2 text-right text-[13px] font-semibold tabular-nums ${
                      wr >= 52 ? 'text-radiant' : wr < 48 ? 'text-dire' : 'text-foreground'
                    }`}
                  >
                    {wr.toFixed(2)}%
                  </td>
                  {(bracket === 'pub' || bracket === 'turbo') && (() => {
                    const delta = trendDelta(h, bracket)
                    if (delta == null || Math.abs(delta) < 0.3) {
                      return <td className="px-2 text-right text-[13px] text-muted">-</td>
                    }
                    return (
                      <td
                        className={`px-2 text-right text-[13px] tabular-nums ${delta > 0 ? 'text-radiant' : 'text-dire'}`}
                        title="Win rate, recent half of the window vs the earlier half"
                      >
                        {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                      </td>
                    )
                  })()}
                  {bracket === 'pro' && (
                    <td className="px-2 text-right text-[13px] tabular-nums text-dire">
                      {(h.pro_ban ?? 0).toLocaleString()}
                      <span className="ml-1 text-[12px] text-muted">
                        ({(((h.pro_ban ?? 0) / totalProMatchesForBans) * 100).toFixed(0)}%)
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}


/* URL slug per bracket: /meta is All Ranks, /meta/<slug> for the rest. */
export const BRACKET_SLUGS: Record<string, Bracket> = {
  herald: '1',
  guardian: '2',
  crusader: '3',
  archon: '4',
  legend: '5',
  ancient: '6',
  divine: '78',
  immortal: '78',
  turbo: 'turbo',
  pro: 'pro',
}
const slugOf = (b: Bracket): string | null =>
  Object.entries(BRACKET_SLUGS).find(([, v]) => v === b)?.[0] ?? null

export function MetaView({ bracket }: { bracket: Bracket }) {
  const label = BRACKETS.find((b) => b.key === bracket)?.label ?? 'Meta'
  usePageTitle(bracket === 'pub' ? 'Meta' : `Meta · ${label}`)
  const heroes = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
    staleTime: 5 * 60 * 1000,
  })

  if (heroes.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const data = heroes.data ?? []

  return (
    <div className="space-y-6 py-4">
      {/* Bracket selector, one URL per bracket */}
      <div className="flex flex-wrap items-center gap-1 font-dota" role="tablist">
        {BRACKETS.map((b) => {
          const active = bracket === b.key
          const slug = slugOf(b.key)
          return (
            <Link
              key={b.key}
              to={slug ? '/meta/$bracket' : '/meta'}
              params={slug ? { bracket: slug } : undefined}
              role="tab"
              aria-current={active ? 'page' : undefined}
              className={`min-h-11 flex items-center gap-1.5 px-3 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 border ${
                active ? 'bg-border border-gold' : 'border-border text-muted'
              }`}
              style={{
                background: active ? undefined : 'rgba(12,11,14,0.72)',
                color: active ? '#e8e2d4' : undefined,
                letterSpacing: '1px',
              }}
            >
              {b.medal && <img src={`/ranks/rank_icon_${b.medal}.webp`} alt="" loading="lazy" style={{ width: 20, height: 20 }} />}
              {b.label}
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {LANES.map((lane) => (
          <LaneCard key={lane.pos} lane={lane} heroes={data} bracket={bracket} />
        ))}
      </div>

      <div className="max-w-[1100px]">
        <HeroTable heroes={data} bracket={bracket} />
      </div>
    </div>
  )
}
