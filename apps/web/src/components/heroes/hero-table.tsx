import { useState } from 'react'
import type { HeroStat } from 'types'
import { winRate } from '@/lib/utils'

type SortKey = 'winrate' | 'pickrate' | 'banrate' | 'name'

function totals(h: HeroStat) {
  const picks = [1, 2, 3, 4, 5, 6, 7, 8].reduce(
    (s, i) => s + ((h as unknown as Record<string, number>)[`${i}_pick`] ?? 0),
    0
  )
  const wins = [1, 2, 3, 4, 5, 6, 7, 8].reduce(
    (s, i) => s + ((h as unknown as Record<string, number>)[`${i}_win`] ?? 0),
    0
  )
  return { picks, wins }
}

const ROLES = [
  'All',
  'Carry',
  'Support',
  'Nuker',
  'Initiator',
  'Disabler',
  'Jungler',
  'Durable',
  'Escape',
  'Pusher',
]

export function HeroTable({ heroes }: { heroes: HeroStat[] }) {
  const [sort, setSort] = useState<SortKey>('pickrate')
  const [role, setRole] = useState('All')

  const filtered = heroes.filter((h) => role === 'All' || h.roles.includes(role))
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.localized_name.localeCompare(b.localized_name)
    if (sort === 'winrate') {
      const { picks: ap, wins: aw } = totals(a)
      const { picks: bp, wins: bw } = totals(b)
      return bw / (bp || 1) - aw / (ap || 1)
    }
    if (sort === 'pickrate') return totals(b).picks - totals(a).picks
    if (sort === 'banrate') return b.pro_ban - a.pro_ban
    return 0
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded border px-2 py-0.5 text-xs ${
              role === r
                ? 'border-accent text-accent'
                : 'border-border text-muted hover:text-foreground'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2 font-normal">Hero</th>
            {(['winrate', 'pickrate', 'banrate'] as SortKey[]).map((key) => (
              <th
                key={key}
                onClick={() => setSort(key)}
                className={`cursor-pointer pb-2 text-right font-normal capitalize ${
                  sort === key ? 'text-foreground' : ''
                }`}
              >
                {key === 'winrate' ? 'Win%' : key === 'pickrate' ? 'Picks' : 'Pro Bans'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, i) => {
            const { picks, wins } = totals(h)
            return (
              <tr
                key={h.id}
                className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="py-1.5">
                  <a href={`/hero/${h.id}`} className="flex items-center gap-2 hover:text-accent">
                    <img
                      src={`https://cdn.opendota.com${h.icon}`}
                      alt={h.localized_name}
                      className="h-6 w-6 rounded"
                    />
                    <span className="text-foreground">{h.localized_name}</span>
                    <span className="text-xs text-muted">{h.primary_attr}</span>
                  </a>
                </td>
                <td className="py-1.5 text-right font-mono text-foreground">
                  {winRate(wins, picks)}
                </td>
                <td className="py-1.5 text-right font-mono text-muted">
                  {picks.toLocaleString()}
                </td>
                <td className="py-1.5 text-right font-mono text-muted">{h.pro_ban}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
