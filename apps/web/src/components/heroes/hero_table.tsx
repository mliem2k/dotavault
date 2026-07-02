import { useState } from 'react'
import type { HeroStat } from 'types'
import { heroBracketTotal, heroIconUrl, winRate } from '@/lib/utils'

type SortKey = 'winrate' | 'pickrate' | 'banrate' | 'name'

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
      const ap = heroBracketTotal(a, 'pick')
      const aw = heroBracketTotal(a, 'win')
      const bp = heroBracketTotal(b, 'pick')
      const bw = heroBracketTotal(b, 'win')
      return bw / (bp || 1) - aw / (ap || 1)
    }
    if (sort === 'pickrate') return heroBracketTotal(b, 'pick') - heroBracketTotal(a, 'pick')
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
            <th className="pb-2 font-normal">Rank</th>
            <th className="pb-2 font-normal">Hero</th>
            <th className="pb-2 font-normal">Role</th>
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
          {sorted.map((h, idx) => {
            const picks = heroBracketTotal(h, 'pick')
            const wins = heroBracketTotal(h, 'win')
            return (
              <tr
                key={h.id}
                className={`border-b border-border/50 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="py-1.5 font-mono text-muted">{idx + 1}</td>
                <td className="py-1.5">
                  <a href={`/hero/${h.id}`} className="flex items-center gap-2 hover:text-accent">
                    <img
                      src={heroIconUrl(h.name)}
                      alt={h.localized_name}
                      className="h-6 w-6 rounded"
                    />
                    <span className="text-foreground">{h.localized_name}</span>
                    <span className="text-xs text-muted">{h.primary_attr}</span>
                  </a>
                </td>
                <td className="py-1.5 text-muted">{h.roles?.[0] ?? '—'}</td>
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
