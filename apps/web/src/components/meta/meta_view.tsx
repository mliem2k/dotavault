import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { HeroStat } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { SortHeader } from '@/components/ui/sort_header'
import { opendota } from '@/lib/opendota'
import { RANK_NAMES } from '@/lib/rank'
import { applySort, useSort } from '@/lib/sortable'
import { usePageTitle } from '@/lib/title'
import { heroIconUrl, heroSlug } from '@/lib/utils'

/* Meta page: pick, win, and (for pro) ban rates for every hero, filterable
   by rank bracket, Turbo, and professional Captains Mode, with per-lane
   leaders on top. Data is OpenDota heroStats (this month's matches). */

type Bracket = 'pub' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'turbo' | 'pro'

const BRACKETS: { key: Bracket; label: string; medal?: number }[] = [
  { key: 'pub', label: 'All Ranks' },
  { key: '1', label: RANK_NAMES[1], medal: 1 },
  { key: '2', label: RANK_NAMES[2], medal: 2 },
  { key: '3', label: RANK_NAMES[3], medal: 3 },
  { key: '4', label: RANK_NAMES[4], medal: 4 },
  { key: '5', label: RANK_NAMES[5], medal: 5 },
  { key: '6', label: RANK_NAMES[6], medal: 6 },
  { key: '7', label: RANK_NAMES[7], medal: 7 },
  { key: '8', label: RANK_NAMES[8], medal: 8 },
  { key: 'turbo', label: 'Turbo' },
  { key: 'pro', label: 'Pro' },
]

const raw = (h: HeroStat, key: string): number => (h as unknown as Record<string, number>)[key] ?? 0

function picksOf(h: HeroStat, b: Bracket): number {
  if (b === 'pub') return [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, i) => s + raw(h, `${i}_pick`), 0)
  if (b === 'turbo') return h.turbo_picks ?? 0
  if (b === 'pro') return h.pro_pick ?? 0
  return raw(h, `${b}_pick`)
}

function winsOf(h: HeroStat, b: Bracket): number {
  if (b === 'pub') return [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, i) => s + raw(h, `${i}_win`), 0)
  if (b === 'turbo') return h.turbo_wins ?? 0
  if (b === 'pro') return h.pro_win ?? 0
  return raw(h, `${b}_win`)
}

const winPct = (h: HeroStat, b: Bracket): number => {
  const p = picksOf(h, b)
  return p > 0 ? (winsOf(h, b) / p) * 100 : 0
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase"
        style={{
          color: '#c8c2b4',
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
          borderBottom: '1px solid #24222a',
        }}
      >
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

const LANES = [
  { pos: 1, label: 'Safe Lane', color: '#8ec63f', filter: (h: HeroStat) => h.roles.includes('Carry') },
  {
    pos: 2,
    label: 'Mid Lane',
    color: '#4fb0e0',
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
    color: '#c47adf',
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
  const top = [...heroes]
    .filter(lane.filter)
    .filter((h) => picksOf(h, bracket) >= minPicks(bracket))
    .sort((a, b) => winPct(b, bracket) - winPct(a, bracket))
    .slice(0, 8)

  return (
    <Panel title={lane.label}>
      <div
        className="mb-3 text-[12px] font-bold uppercase tracking-widest"
        style={{ color: lane.color, fontFamily: 'var(--font-dota)' }}
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
              className="flex items-center gap-2 py-1.5 hover:bg-white/[0.03]"
              style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
            >
              <span
                className="w-4 text-right tabular-nums text-[12px]"
                style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
              >
                {i + 1}
              </span>
              <img src={heroIconUrl(h.name)} alt={h.localized_name} className="h-6 w-6 rounded shrink-0" />
              <span className="flex-1 text-[14px] truncate" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                {h.localized_name}
              </span>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{
                  color: wrPct >= 52 ? '#8ec63f' : wrPct < 48 ? '#d14a38' : '#dcd6c8',
                  fontFamily: 'var(--font-dota)',
                }}
              >
                {wrPct.toFixed(1)}%
              </span>
              <span className="w-14 text-right text-[12px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
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

  const th = (label: string, k: SortKey, align: 'left' | 'right' = 'right') => (
    <th className={`pb-2 ${align === 'left' ? 'text-left' : 'text-right'} px-2`}>
      <SortHeader label={label} sortKey={k} active={key === k} dir={dir} onClick={(sk) => onSort(sk as SortKey)} />
    </th>
  )

  return (
    <Panel title={`Hero Win Rates: ${BRACKETS.find((b) => b.key === bracket)?.label ?? ''}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hero..."
          className="px-3 py-1.5 text-[13px] outline-none"
          style={{
            background: 'rgba(8,10,12,0.7)',
            border: '1px solid #24222a',
            color: '#dcd6c8',
            fontFamily: 'var(--font-dota)',
            width: 200,
          }}
        />
        <div className="flex items-center" style={{ border: '1px solid #24222a' }}>
          {ATTRS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAttr(a.key)}
              className="px-2.5 py-1.5 text-[12px] uppercase cursor-pointer"
              style={{
                background: attr === a.key ? '#24222a' : 'transparent',
                color: attr === a.key ? '#dcd6c8' : '#8a8474',
                letterSpacing: '1px',
                fontFamily: 'var(--font-dota)',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
          {rows.length} heroes
        </span>
      </div>
      <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-dota)' }}>
        <thead>
          <tr className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#8a8474' }}>
            <th className="pb-2 pr-2 text-right" style={{ width: 30 }}>#</th>
            {th('Hero', 'name', 'left')}
            <th className="pb-2 px-2 text-left">Attr</th>
            {th('Picks', 'picks')}
            {th('Pick Rate', 'pickrate')}
            {th('Win Rate', 'winrate')}
            {bracket === 'pro' && th('Bans', 'banrate')}
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => {
            const picks = picksOf(h, bracket)
            const wr = winPct(h, bracket)
            const pickRate = totalMatches > 0 ? (picks / totalMatches) * 100 : 0
            return (
              <tr key={h.id} className="hover:bg-white/[0.03]" style={{ borderTop: '1px solid #1c1810' }}>
                <td className="py-1.5 pr-2 text-right text-[12px] tabular-nums" style={{ color: '#4a4436' }}>
                  {i + 1}
                </td>
                <td className="px-2 py-1.5">
                  <a href={`/hero/${heroSlug(h.localized_name)}`} className="flex items-center gap-2 hover:underline">
                    <img src={heroIconUrl(h.name)} alt="" className="h-6 w-6 rounded" />
                    <span className="text-[14px]" style={{ color: '#dcd6c8' }}>{h.localized_name}</span>
                  </a>
                </td>
                <td className="px-2 text-[12px] uppercase" style={{ color: '#8a8474' }}>
                  {h.primary_attr === 'all' ? 'uni' : h.primary_attr}
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#dcd6c8' }}>
                  {picks.toLocaleString()}
                </td>
                <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#c9a94a' }}>
                  {pickRate.toFixed(1)}%
                </td>
                <td
                  className="px-2 text-right text-[13px] font-semibold tabular-nums"
                  style={{ color: wr >= 52 ? '#8ec63f' : wr < 48 ? '#d14a38' : '#dcd6c8' }}
                >
                  {wr.toFixed(2)}%
                </td>
                {bracket === 'pro' && (
                  <td className="px-2 text-right text-[13px] tabular-nums" style={{ color: '#d14a38' }}>
                    {(h.pro_ban ?? 0).toLocaleString()}
                    <span className="ml-1 text-[12px]" style={{ color: '#8a8474' }}>
                      ({(((h.pro_ban ?? 0) / totalProMatchesForBans) * 100).toFixed(0)}%)
                    </span>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
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
  divine: '7',
  immortal: '8',
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
      <div className="flex flex-wrap items-center gap-1" style={{ fontFamily: 'var(--font-dota)' }}>
        {BRACKETS.map((b) => {
          const active = bracket === b.key
          const slug = slugOf(b.key)
          return (
            <Link
              key={b.key}
              to={slug ? '/meta/$bracket' : '/meta'}
              params={slug ? { bracket: slug } : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125"
              style={{
                background: active ? '#24222a' : 'rgba(12,11,14,0.72)',
                border: `1px solid ${active ? '#c9a94a' : '#24222a'}`,
                color: active ? '#e8e2d4' : '#8a8474',
                letterSpacing: '1px',
              }}
            >
              {b.medal && <img src={`/ranks/rank_icon_${b.medal}.webp`} alt="" style={{ width: 20, height: 20 }} />}
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

      <HeroTable heroes={data} bracket={bracket} />
    </div>
  )
}
