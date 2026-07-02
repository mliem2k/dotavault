import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDuration } from '@/lib/utils'

type Tab = 'gold' | 'xp'

export function AdvantageGraph({
  radiantGoldAdv,
  radiantXpAdv,
  activeMinute,
}: {
  radiantGoldAdv: number[] | null
  radiantXpAdv: number[] | null
  activeMinute?: number
}) {
  const [activeTab, setActiveTab] = useState<Tab>('gold')

  const series = activeTab === 'gold' ? radiantGoldAdv : radiantXpAdv

  if (!series || series.length === 0) {
    return <div className="text-xs text-muted">Advantage data unavailable</div>
  }

  const data = series.map((value, i) => ({ time: i * 60, value }))

  // Compute the gradient offset so the color split lands exactly at y=0
  const max = Math.max(...series, 0)
  const min = Math.min(...series, 0)
  const range = max - min
  const pct = range === 0 ? 1 : max / range

  const label = activeTab === 'gold' ? 'Gold Adv' : 'XP Adv'

  return (
    <div className="space-y-2">
      <div className="flex gap-2 px-1">
        {(['gold', 'xp'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-accent text-accent-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab === 'gold' ? 'Gold' : 'XP'}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="advGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset={pct} stopColor="#4ade80" stopOpacity={0.35} />
              <stop offset={pct} stopColor="#f87171" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="advStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={pct} stopColor="#4ade80" stopOpacity={1} />
              <stop offset={pct} stopColor="#f87171" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="time"
            tickFormatter={formatDuration}
            tick={{ fill: '#888', fontSize: 10 }}
          />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#555" />
          {activeMinute !== undefined && (
            <ReferenceLine x={activeMinute * 60} stroke="#0070f3" strokeWidth={1.5} strokeDasharray="4 2" />
          )}
          <Tooltip
            formatter={(v) => [(v as number) > 0 ? `+${v}` : v, label]}
            labelFormatter={(l) => formatDuration(l as number)}
            contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#advStroke)"
            fill="url(#advGradient)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
