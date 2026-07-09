type Total = { field: string; n: number; sum: number }

function avg(totals: Total[], field: string): number {
  const t = totals.find((x) => x.field === field)
  return t && t.n > 0 ? t.sum / t.n : 0
}

function sum(totals: Total[], field: string): number {
  return totals.find((x) => x.field === field)?.sum ?? 0
}

const AXES = ['Fighting', 'Farming', 'Supporting', 'Pushing', 'Versatility'] as const

export function PlayStyleRadar({
  totals,
  heroesPlayed,
}: {
  totals: Total[]
  heroesPlayed: number
}) {
  const avgKills = avg(totals, 'kills')
  const avgLh = avg(totals, 'last_hits')
  const avgAssists = avg(totals, 'assists')
  const avgTowerDmg = avg(totals, 'tower_damage')

  // Normalise each axis to 0..1 against a sensible cap.
  const values = [
    Math.min(1, avgKills / 12),
    Math.min(1, avgLh / 260),
    Math.min(1, avgAssists / 24),
    Math.min(1, avgTowerDmg / 5000),
    Math.min(1, heroesPlayed / 60),
  ]

  const size = 260
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 34

  const pointAt = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]
  }

  const ringPath = (frac: number) =>
    AXES.map((_, i) => {
      const [x, y] = pointAt(i, R * frac)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ') + ' Z'

  const dataPath =
    values
      .map((v, i) => {
        const [x, y] = pointAt(i, R * Math.max(0.04, v))
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ') + ' Z'

  const pct = values.map((v) => Math.round(v * 100))
  const summary = AXES.map((label, i) => `${label} ${pct[i]}%`).join(', ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      style={{ maxWidth: 280, overflow: 'visible' }}
      role="img"
      aria-label={summary}
    >
      {/* grid rings */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <path key={f} d={ringPath(f)} fill="none" className="stroke-slate-border" strokeWidth={1} />
      ))}
      {/* axes */}
      {AXES.map((_, i) => {
        const [x, y] = pointAt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-slate-border" strokeWidth={1} />
      })}
      {/* data polygon */}
      <path d={dataPath} fill="rgba(201,169,74,0.3)" className="stroke-gold" strokeWidth={2} />
      {values.map((v, i) => {
        const [x, y] = pointAt(i, R * Math.max(0.04, v))
        return <circle key={i} cx={x} cy={y} r={2.5} className="fill-gold" />
      })}
      {/* labels */}
      {AXES.map((label, i) => {
        const [x, y] = pointAt(i, R + 18)
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-dota fill-slate-muted-light"
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

export function LifetimeStats({ totals }: { totals: Total[] }) {
  const averages: [string | number, string][] = [
    [String(Math.round(avg(totals, 'gold_per_min'))), 'Avg GPM'],
    [String(Math.round(avg(totals, 'xp_per_min'))), 'Avg XPM'],
    [String(Math.round(avg(totals, 'last_hits'))), 'Avg Last Hits'],
  ]
  const lifetime: [string | number, string][] = [
    [Math.round(avg(totals, 'kda') * 10) / 10, 'Avg KDA'],
    [sum(totals, 'tower_kills').toLocaleString(), 'Tower Kills'],
    [sum(totals, 'neutral_kills').toLocaleString(), 'Neutral Kills'],
    [sum(totals, 'courier_kills').toLocaleString(), 'Couriers Killed'],
    [sum(totals, 'purchase_ward_observer').toLocaleString(), 'Observer Wards'],
    [sum(totals, 'purchase_rapier').toLocaleString(), 'Rapiers Bought'],
  ]
  const row = ([value, label]: [string | number, string]) => (
    <div key={label} className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-right text-[15px] tabular-nums text-gold font-dota">
        {value}
      </span>
      <span className="text-[13px] text-slate-foreground font-dota">
        {label}
      </span>
    </div>
  )
  return (
    <div className="space-y-1.5">
      {averages.map(row)}
      <div className="bg-slate-border" style={{ height: 1, margin: '8px 0' }} />
      {lifetime.map(row)}
    </div>
  )
}
