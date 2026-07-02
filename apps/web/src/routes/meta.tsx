import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { heroIconUrl, winRate } from '@/lib/utils'
import type { HeroStat } from 'types'

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

const LANES = [
  {
    pos: 1,
    label: 'Safe Lane',
    color: 'text-green-400',
    filter: (h: HeroStat) => h.roles.includes('Carry'),
  },
  {
    pos: 2,
    label: 'Mid Lane',
    color: 'text-blue-400',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      (h.roles.includes('Nuker') || h.primary_attr === 'int'),
  },
  {
    pos: 3,
    label: 'Off Lane',
    color: 'text-orange-400',
    filter: (h: HeroStat) =>
      !h.roles.includes('Carry') &&
      !h.roles.includes('Support') &&
      (h.roles.includes('Initiator') || h.roles.includes('Durable')),
  },
  {
    pos: 4,
    label: 'Soft Support',
    color: 'text-purple-400',
    filter: (h: HeroStat) => h.roles.includes('Support') && !h.roles.includes('Disabler'),
  },
  {
    pos: 5,
    label: 'Hard Support',
    color: 'text-pink-400',
    filter: (h: HeroStat) => h.roles.includes('Support') && h.roles.includes('Disabler'),
  },
]

function LaneCard({ lane, heroes }: { lane: (typeof LANES)[0]; heroes: HeroStat[] }) {
  const top = [...heroes]
    .filter(lane.filter)
    .sort((a, b) => immortalWinRate(b) - immortalWinRate(a))
    .slice(0, 8)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-xs font-mono font-semibold ${lane.color}`}>POS {lane.pos}</span>
        <span className="font-medium text-sm">{lane.label}</span>
      </div>
      <div className="space-y-1">
        {top.map((h, i) => {
          const picks = immortalPicks(h)
          const wr = immortalWinRate(h)
          return (
            <a
              key={h.id}
              href={`/hero/${h.id}`}
              className="flex items-center gap-2 rounded px-1 py-1 hover:bg-white/5"
            >
              <span className="w-4 text-right font-mono text-xs text-muted">{i + 1}</span>
              <img
                src={heroIconUrl(h.name)}
                alt={h.localized_name}
                className="h-6 w-6 rounded flex-shrink-0"
              />
              <span className="flex-1 text-sm">{h.localized_name}</span>
              <span
                className={`font-mono text-xs font-semibold ${wr >= 0.52 ? 'text-radiant' : wr < 0.48 ? 'text-dire' : 'text-foreground'}`}
              >
                {winRate(Math.round(wr * picks), picks)}
              </span>
              <span className="w-12 text-right font-mono text-xs text-muted">
                {picks.toLocaleString()}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function TopHeroesTable({ heroes }: { heroes: HeroStat[] }) {
  const top = [...heroes]
    .filter((h) => immortalPicks(h) >= 100)
    .sort((a, b) => immortalWinRate(b) - immortalWinRate(a))
    .slice(0, 20)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-medium text-sm">Top Heroes — Immortal Bracket</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">Hero</th>
            <th className="pb-2 font-normal text-right">Win%</th>
            <th className="pb-2 font-normal text-right">Picks</th>
            <th className="pb-2 font-normal text-right">Pro Ban</th>
          </tr>
        </thead>
        <tbody>
          {top.map((h, i) => {
            const picks = immortalPicks(h)
            const wr = immortalWinRate(h)
            return (
              <tr key={h.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                <td className="py-1.5 font-mono text-xs text-muted">{i + 1}</td>
                <td className="py-1.5">
                  <a href={`/hero/${h.id}`} className="flex items-center gap-2 hover:text-accent">
                    <img
                      src={heroIconUrl(h.name)}
                      alt={h.localized_name}
                      className="h-6 w-6 rounded"
                    />
                    <span>{h.localized_name}</span>
                  </a>
                </td>
                <td
                  className={`py-1.5 text-right font-mono text-xs font-semibold ${wr >= 0.52 ? 'text-radiant' : wr < 0.48 ? 'text-dire' : 'text-foreground'}`}
                >
                  {winRate(Math.round(wr * picks), picks)}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-muted">
                  {picks.toLocaleString()}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-muted">{h.pro_ban}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Meta</h1>
        <p className="text-sm text-muted">Immortal bracket win rates · current patch</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {LANES.map((lane) => (
          <LaneCard key={lane.pos} lane={lane} heroes={data} />
        ))}
        <div className="lg:col-span-2 xl:col-span-3">
          <TopHeroesTable heroes={data} />
        </div>
      </div>
    </div>
  )
}
