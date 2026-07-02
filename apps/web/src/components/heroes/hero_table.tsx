import { useState } from 'react'
import type { HeroStat } from 'types'
import { heroBracketTotal, heroIconUrl, winRate } from '@/lib/utils'

type SortKey = 'winrate' | 'pickrate' | 'banrate' | 'name'

const ROLES = [
  'All', 'Carry', 'Support', 'Nuker', 'Initiator',
  'Disabler', 'Jungler', 'Durable', 'Escape', 'Pusher',
]

const SORT_LABELS: Record<SortKey, string> = {
  winrate: 'Win%',
  pickrate: 'Picks',
  banrate: 'Pro Bans',
  name: 'Hero',
}

export function HeroTable({ heroes }: { heroes: HeroStat[] }) {
  const [sort, setSort] = useState<SortKey>('pickrate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [role, setRole] = useState('All')

  function handleSort(key: SortKey) {
    if (sort === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const filtered = heroes.filter((h) => role === 'All' || h.roles.includes(role))

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sort === 'name') {
      cmp = a.localized_name.localeCompare(b.localized_name)
    } else if (sort === 'winrate') {
      const ap = heroBracketTotal(a, 'pick')
      const aw = heroBracketTotal(a, 'win')
      const bp = heroBracketTotal(b, 'pick')
      const bw = heroBracketTotal(b, 'win')
      cmp = bw / (bp || 1) - aw / (ap || 1)
    } else if (sort === 'pickrate') {
      cmp = heroBracketTotal(b, 'pick') - heroBracketTotal(a, 'pick')
    } else if (sort === 'banrate') {
      cmp = b.pro_ban - a.pro_ban
    }
    return sortDir === 'asc' ? -cmp : cmp
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
            <th className="pb-2 font-normal w-8">Rank</th>
            {(['name', 'winrate', 'pickrate', 'banrate'] as SortKey[]).map((key) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                className={`cursor-pointer select-none pb-2 font-normal ${
                  key === 'name' ? '' : 'text-right'
                } ${sort === key ? 'text-foreground' : 'hover:text-foreground transition-colors'}`}
              >
                {SORT_LABELS[key]}
                {sort === key && (
                  <span className="ml-0.5 opacity-60">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </th>
            ))}
            <th className="pb-2 font-normal text-right">Roles</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, idx) => {
            const picks = heroBracketTotal(h, 'pick')
            const wins = heroBracketTotal(h, 'win')
            const wr = picks > 0 ? wins / picks : 0
            return (
              <tr
                key={h.id}
                className={`border-b border-border/50 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="py-1.5 font-mono text-xs text-muted">{idx + 1}</td>
                <td className="py-1.5" colSpan={2}>
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
                <td className={`py-1.5 text-right font-mono text-xs font-semibold ${wr >= 0.52 ? 'text-radiant' : wr < 0.48 && picks > 0 ? 'text-dire' : 'text-foreground'}`}>
                  {winRate(wins, picks)}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-muted">
                  {picks.toLocaleString()}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-muted">{h.pro_ban}</td>
                <td className="py-1.5 text-right text-xs text-muted max-w-[120px]">
                  {h.roles?.slice(0, 3).join(', ') ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
