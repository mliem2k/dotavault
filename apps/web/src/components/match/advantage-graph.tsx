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

export function AdvantageGraph({
  radiantGoldAdv,
}: {
  radiantGoldAdv: number[] | null
}) {
  if (!radiantGoldAdv || radiantGoldAdv.length === 0) {
    return <div className="text-xs text-muted">Advantage data unavailable</div>
  }

  const data = radiantGoldAdv.map((gold, i) => ({ time: i * 60, gold }))

  // Compute the gradient offset so the color split lands exactly at y=0
  const max = Math.max(...radiantGoldAdv, 0)
  const min = Math.min(...radiantGoldAdv, 0)
  const range = max - min
  const pct = range === 0 ? 1 : max / range

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="goldAdv" x1="0" y1="0" x2="0" y2="1">
            <stop offset={pct} stopColor="#4ade80" stopOpacity={0.35} />
            <stop offset={pct} stopColor="#f87171" stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="goldAdvStroke" x1="0" y1="0" x2="0" y2="1">
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
        <Tooltip
          formatter={(v) => [(v as number) > 0 ? `+${v}` : v, 'Gold Adv']}
          labelFormatter={(l) => formatDuration(l as number)}
          contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="gold"
          stroke="url(#goldAdvStroke)"
          fill="url(#goldAdv)"
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
