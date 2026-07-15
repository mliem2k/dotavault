import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { rankName } from '@/lib/rank'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/explore/distributions')({
  component: DistributionsPage,
})

// Herald..Divine each span 5 star bins (tier*10+1..tier*10+5); Immortal has
// no stars, a single bin (80). Labeling all 36 bins at -45deg was crowded
// and unreadable, so the axis shows one horizontal label per tier (centered
// under that tier's middle star), the full "Herald 3"-style name stays in
// the tooltip on hover.
const TIER_NAMES = [
  '',
  'Herald',
  'Guardian',
  'Crusader',
  'Archon',
  'Legend',
  'Ancient',
  'Divine',
  'Immortal',
]

function TierAxisTick({
  x,
  y,
  index,
  rows,
}: {
  x?: string | number
  y?: string | number
  index?: number
  rows: { bin: number }[]
}) {
  if (x == null || y == null || index == null) return null
  const bin = rows[index]?.bin
  if (bin == null) return null
  const tier = Math.floor(bin / 10)
  const star = bin % 10
  if (tier !== 8 && star !== 3) return null
  return (
    <text x={x} y={Number(y) + 14} textAnchor="middle" fill="#888" fontSize={11}>
      {TIER_NAMES[tier] ?? ''}
    </text>
  )
}

function DistributionsPage() {
  usePageTitle('Explore · Distributions')
  const query = useQuery({
    queryKey: ['distributions'],
    queryFn: () => opendota.distributions(),
    staleTime: 60 * 60 * 1000,
  })

  const rows = useMemo(() => {
    const ranks = query.data?.ranks
    if (!ranks) return []
    const total = ranks.sum.count
    return [...ranks.rows]
      .sort((a, b) => a.bin - b.bin)
      .map((r) => ({
        bin: r.bin,
        name: rankName(r.bin),
        count: r.count,
        percentileBelow: total > 0 ? (r.cumulative_sum / total) * 100 : 0,
      }))
  }, [query.data])

  return (
    <div className="max-w-[1040px] mx-auto">
      <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
        <div
          className="px-4 py-3 uppercase text-foreground font-display border-b border-border"
          style={{ fontSize: 20, fontWeight: 500, letterSpacing: '3px' }}
        >
          Rank Distribution
        </div>
        <div className="px-4 py-3">
          {query.isPending ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-muted">
              Distribution data unavailable.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={(props) => <TierAxisTick {...props} rows={rows} />}
                  interval={0}
                  height={28}
                  axisLine={{ stroke: '#333' }}
                  tickLine={{ stroke: '#333' }}
                />
                <YAxis
                  tick={{ fill: '#888', fontSize: 10 }}
                  width={56}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 11 }}
                  labelStyle={{ color: '#e8e2d4' }}
                  formatter={(_v, _n, item) => [
                    `${item.payload.count.toLocaleString()} players (${item.payload.percentileBelow.toFixed(1)}% at or below)`,
                    '',
                  ]}
                />
                <Bar dataKey="count" fill="var(--color-gold)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
