import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { heroBracketTotal, heroIconFromPath, heroIconUrl, winRate } from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroId')({
  component: HeroDetailPage,
})

const BRACKET_LABELS = [
  '', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal',
]

const ATTR_COLOR: Record<string, string> = {
  str: 'text-red-400',
  agi: 'text-green-400',
  int: 'text-blue-400',
  all: 'text-yellow-400',
}
const ATTR_LABEL: Record<string, string> = {
  str: 'Strength',
  agi: 'Agility',
  int: 'Intelligence',
  all: 'Universal',
}

type Matchup = { hero_id: number; games_played: number; wins: number }
type Duration = { duration_bin: number; games_played: number; wins: number }

type SortKey = 'games' | 'winrate'

function MatchupTable({
  matchups,
  heroMap,
  title,
  sortDir,
}: {
  matchups: Matchup[]
  heroMap: Map<number, { name: string; localized_name: string; icon: string }>
  title: string
  sortDir: 'best' | 'worst'
}) {
  const withWr = matchups
    .filter((m) => m.games_played >= 20)
    .map((m) => ({ ...m, wr: m.wins / m.games_played }))
  const sorted = [...withWr].sort((a, b) =>
    sortDir === 'best' ? b.wr - a.wr : a.wr - b.wr,
  )
  const top = sorted.slice(0, 10)

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{title}</div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-1.5 font-normal">Hero</th>
            <th className="pb-1.5 font-normal text-right">Games</th>
            <th className="pb-1.5 font-normal text-right">Win%</th>
          </tr>
        </thead>
        <tbody>
          {top.map((m) => {
            const h = heroMap.get(m.hero_id)
            if (!h) return null
            const wr = (m.wr * 100).toFixed(1)
            const isGood = sortDir === 'best'
            return (
              <tr key={m.hero_id} className="border-t border-border/30 text-sm hover:bg-card/40">
                <td className="py-1.5">
                  <a href={`/hero/${m.hero_id}`} className="flex items-center gap-2 hover:text-accent">
                    <img
                      src={heroIconFromPath(h.icon)}
                      alt={h.localized_name}
                      className="h-6 w-6 rounded"
                    />
                    <span>{h.localized_name}</span>
                  </a>
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-muted">
                  {m.games_played.toLocaleString()}
                </td>
                <td className={`py-1.5 text-right font-mono text-xs font-medium ${isGood ? 'text-radiant' : 'text-dire'}`}>
                  {wr}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HeroDetailPage() {
  const { heroId } = Route.useParams()
  const [matchupSort, setMatchupSort] = useState<SortKey>('winrate')

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  const matchups = useQuery({
    queryKey: ['hero_matchups', heroId],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/heroes/${heroId}/matchups`)
        .then((r) => r.json()) as Promise<Matchup[]>,
    enabled: !!heroId,
  })

  const durations = useQuery({
    queryKey: ['hero_durations', heroId],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/heroes/${heroId}/durations`)
        .then((r) => r.json()) as Promise<Duration[]>,
    enabled: !!heroId,
  })

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const hero = heroStats.data?.find((h) => String(h.id) === heroId)
  if (!hero) return <div className="text-sm text-muted">Hero not found.</div>

  const picks = heroBracketTotal(hero, 'pick')
  const wins = heroBracketTotal(hero, 'win')

  const heroMap = new Map(
    (heroStats.data ?? []).map((h) => [
      h.id,
      { name: h.name, localized_name: h.localized_name, icon: h.icon },
    ]),
  )

  const brackets = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    label: BRACKET_LABELS[i],
    picks: hero[`${i}_pick` as keyof typeof hero] as number,
    wins: hero[`${i}_win` as keyof typeof hero] as number,
  }))

  const durationData = (durations.data ?? [])
    .filter((d) => d.games_played >= 10)
    .sort((a, b) => a.duration_bin - b.duration_bin)
    .map((d) => ({
      min: Math.round(d.duration_bin / 60),
      wr: +((d.wins / d.games_played) * 100).toFixed(1),
      games: d.games_played,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <img
          src={heroIconUrl(hero.name)}
          alt={hero.localized_name}
          className="h-20 w-20 rounded-lg object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{hero.localized_name}</h1>
            <span className={`text-sm font-medium ${ATTR_COLOR[hero.primary_attr] ?? ''}`}>
              {ATTR_LABEL[hero.primary_attr] ?? hero.primary_attr}
            </span>
            <span className="text-xs text-muted border border-border rounded px-1.5 py-0.5">
              {hero.attack_type}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted">{hero.roles.join(' · ')}</div>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="font-mono text-xl font-medium">{winRate(wins, picks)}</div>
              <div className="text-xs text-muted">Win Rate</div>
            </div>
            <div>
              <div className="font-mono text-xl font-medium">{picks.toLocaleString()}</div>
              <div className="text-xs text-muted">Picks</div>
            </div>
            <div>
              <div className="font-mono text-xl font-medium">{hero.pro_ban}</div>
              <div className="text-xs text-muted">Pro Bans</div>
            </div>
            <div>
              <div className="font-mono text-xl font-medium">{hero.pro_pick}</div>
              <div className="text-xs text-muted">Pro Picks</div>
            </div>
            <div>
              <div className="font-mono text-xl font-medium">{winRate(hero.pro_win, hero.pro_pick)}</div>
              <div className="text-xs text-muted">Pro Win%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Win Rate by Bracket</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted text-left">
                  <th className="pb-2 font-normal">Bracket</th>
                  <th className="pb-2 font-normal text-right">Picks</th>
                  <th className="pb-2 font-normal text-right">Win%</th>
                  <th className="pb-2 font-normal pl-3">Bar</th>
                </tr>
              </thead>
              <tbody>
                {brackets.map(({ label, picks: p, wins: w }) => {
                  const wr = p > 0 ? (w / p) * 100 : 0
                  return (
                    <tr key={label} className="border-t border-border/30 text-sm">
                      <td className="py-1.5 text-muted">{label}</td>
                      <td className="py-1.5 text-right font-mono text-xs text-muted">
                        {p.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs font-medium">
                        {p > 0 ? `${wr.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-1.5 pl-3 w-24">
                        <div className="h-1.5 bg-card rounded overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${Math.min(wr, 100)}%`,
                              backgroundColor: wr >= 50 ? 'var(--color-radiant)' : 'var(--color-dire)',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Win Rate by Duration</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {durationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={durationData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="min"
                    tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}m`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[30, 70]}
                    tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Win Rate']}
                    labelFormatter={(v) => `${v} min`}
                  />
                  <Area
                    type="monotone"
                    dataKey="wr"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="url(#wrGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center py-8 text-sm text-muted">
                {durations.isPending ? <Spinner /> : 'No duration data'}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Matchups</CardTitle>
            <div className="flex gap-1">
              {(['winrate', 'games'] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setMatchupSort(k)}
                  className={`rounded border px-2 py-0.5 text-xs ${matchupSort === k ? 'border-accent text-accent' : 'border-border text-muted hover:text-foreground'}`}
                >
                  {k === 'winrate' ? 'By Win%' : 'By Games'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <div className="px-4 pb-4">
          {matchups.isPending ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <MatchupTable
                matchups={matchups.data ?? []}
                heroMap={heroMap}
                title="Best against (highest win rate)"
                sortDir="best"
              />
              <MatchupTable
                matchups={matchups.data ?? []}
                heroMap={heroMap}
                title="Worst against (lowest win rate)"
                sortDir="worst"
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base Stats</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ['Move Speed', hero.move_speed],
              ['Attack Range', hero.attack_range],
              ['Base Armor', hero.base_armor],
              ['Base Damage', `${hero.base_attack_min}–${hero.base_attack_max}`],
              ['Base STR', `${hero.base_str} +${hero.str_gain}`],
              ['Base AGI', `${hero.base_agi} +${hero.agi_gain}`],
              ['Base INT', `${hero.base_int} +${hero.int_gain}`],
              ['Base HP', hero.base_health],
              ['Base Mana', hero.base_mana],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between py-1 border-b border-border/20">
                <span className="text-muted">{label}</span>
                <span className="font-mono text-xs">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
