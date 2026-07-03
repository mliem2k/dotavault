import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { HeroStat } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { heroIconUrl, winRate } from '@/lib/utils'

export const Route = createFileRoute('/meta')({
  component: MetaPage,
})

type BracketKey = `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}_${'pick' | 'win'}`

function bracketVal(h: HeroStat, key: BracketKey): number {
  return (h as unknown as Record<string, number>)[key] ?? 0
}

function immortalWinRate(h: HeroStat): number {
  const picks = bracketVal(h, '8_pick')
  const wins = bracketVal(h, '8_win')
  return picks > 0 ? wins / picks : 0
}

function immortalPicks(h: HeroStat): number {
  return bracketVal(h, '8_pick')
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
  {
    pos: 1,
    label: 'Safe Lane',
    color: '#8ec63f',
    filter: (h: HeroStat) => h.roles.includes('Carry'),
  },
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

function LaneCard({ lane, heroes }: { lane: (typeof LANES)[0]; heroes: HeroStat[] }) {
  const top = [...heroes]
    .filter(lane.filter)
    .sort((a, b) => immortalWinRate(b) - immortalWinRate(a))
    .slice(0, 8)

  return (
    <Panel title={lane.label}>
      <div
        className="mb-3 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: lane.color, fontFamily: 'var(--font-dota)' }}
      >
        Position {lane.pos}
      </div>
      <div>
        {top.map((h, i) => {
          const picks = immortalPicks(h)
          const wr = immortalWinRate(h)
          const wrPct = wr * 100
          return (
            <a
              key={h.id}
              href={`/hero/${h.name.replace('npc_dota_hero_', '')}`}
              className="flex items-center gap-2 py-1.5 hover:bg-white/[0.03]"
              style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
            >
              <span
                className="w-4 text-right tabular-nums text-[12px]"
                style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
              >
                {i + 1}
              </span>
              <img
                src={heroIconUrl(h.name)}
                alt={h.localized_name}
                className="h-6 w-6 rounded shrink-0"
              />
              <span
                className="flex-1 text-[14px] truncate"
                style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
              >
                {h.localized_name}
              </span>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{
                  color: wrPct >= 52 ? '#8ec63f' : wrPct < 48 ? '#d14a38' : '#dcd6c8',
                  fontFamily: 'var(--font-dota)',
                }}
              >
                {winRate(Math.round(wr * picks), picks)}
              </span>
              <span
                className="w-14 text-right text-[12px] tabular-nums"
                style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
              >
                {picks.toLocaleString()}
              </span>
            </a>
          )
        })}
      </div>
    </Panel>
  )
}

function TopHeroesTable({ heroes }: { heroes: HeroStat[] }) {
  const top = [...heroes]
    .filter((h) => immortalPicks(h) >= 100)
    .sort((a, b) => immortalWinRate(b) - immortalWinRate(a))
    .slice(0, 20)

  return (
    <Panel title="Top 20 Heroes: Immortal Bracket">
      <table className="w-full">
        <thead>
          <tr>
            <th
              className="pb-2 text-left text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
            >
              #
            </th>
            <th
              className="pb-2 text-left text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
            >
              Hero
            </th>
            <th
              className="pb-2 text-right text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
            >
              Win%
            </th>
            <th
              className="pb-2 text-right text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
            >
              Picks
            </th>
            <th
              className="pb-2 text-right text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
            >
              Pro Ban
            </th>
          </tr>
        </thead>
        <tbody>
          {top.map((h, i) => {
            const picks = immortalPicks(h)
            const wr = immortalWinRate(h)
            const wrPct = wr * 100
            return (
              <tr
                key={h.id}
                className="hover:bg-white/[0.03]"
                style={{ borderTop: '1px solid #1c1810' }}
              >
                <td
                  className="py-1.5 text-[12px] tabular-nums"
                  style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
                >
                  {i + 1}
                </td>
                <td className="py-1.5">
                  <a
                    href={`/hero/${h.name.replace('npc_dota_hero_', '')}`}
                    className="flex items-center gap-2"
                  >
                    <img
                      src={heroIconUrl(h.name)}
                      alt={h.localized_name}
                      className="h-6 w-6 rounded"
                    />
                    <span
                      className="text-[14px]"
                      style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                    >
                      {h.localized_name}
                    </span>
                  </a>
                </td>
                <td
                  className="py-1.5 text-right text-[13px] font-semibold tabular-nums"
                  style={{
                    color: wrPct >= 52 ? '#8ec63f' : wrPct < 48 ? '#d14a38' : '#dcd6c8',
                    fontFamily: 'var(--font-dota)',
                  }}
                >
                  {winRate(Math.round(wr * picks), picks)}
                </td>
                <td
                  className="py-1.5 text-right text-[12px] tabular-nums"
                  style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                >
                  {picks.toLocaleString()}
                </td>
                <td
                  className="py-1.5 text-right text-[12px] tabular-nums"
                  style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                >
                  {h.pro_ban}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

function MetaPage() {
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
      <div className="text-center mb-6">
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '2px' }}
        >
          Meta
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em]"
          style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
        >
          Immortal bracket win rates · current patch
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {LANES.map((lane) => (
          <LaneCard key={lane.pos} lane={lane} heroes={data} />
        ))}
      </div>

      <TopHeroesTable heroes={data} />
    </div>
  )
}
