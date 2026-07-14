import { useQuery } from '@tanstack/react-query'
import type { ProMetaWinrateCell } from 'types'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { fetchProMeta } from '@/lib/pro_meta'
import { usePageTitle } from '@/lib/title'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function StatBar({
  label,
  cell,
  variant,
}: {
  label: string
  cell: ProMetaWinrateCell
  variant: 'radiant' | 'dire'
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] uppercase text-muted">{label}</span>
      <span
        className={`font-dota text-[15px] ${variant === 'radiant' ? 'text-radiant' : 'text-dire'}`}
      >
        {pct(cell.winrate)} <span className="text-muted text-[11px]">({cell.sample})</span>
      </span>
    </div>
  )
}

function ComboGrid({
  radiantFirst,
  radiantSecond,
  direFirst,
  direSecond,
}: {
  radiantFirst: ProMetaWinrateCell
  radiantSecond: ProMetaWinrateCell
  direFirst: ProMetaWinrateCell
  direSecond: ProMetaWinrateCell
}) {
  const cells: { label: string; cell: ProMetaWinrateCell; variant: 'radiant' | 'dire' }[] = [
    { label: 'Radiant + First Pick', cell: radiantFirst, variant: 'radiant' },
    { label: 'Radiant + Second Pick', cell: radiantSecond, variant: 'radiant' },
    { label: 'Dire + First Pick', cell: direFirst, variant: 'dire' },
    { label: 'Dire + Second Pick', cell: direSecond, variant: 'dire' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cells.map((c) => (
        <div key={c.label} className="border border-border p-3">
          <div className="text-[12px] uppercase text-muted mb-1">{c.label}</div>
          <div
            className={`font-dota text-[20px] ${c.variant === 'radiant' ? 'text-radiant' : 'text-dire'}`}
          >
            {pct(c.cell.winrate)}
          </div>
          <div className="text-[11px] text-muted">{c.cell.sample} matches</div>
        </div>
      ))}
    </div>
  )
}

export function ProMetaView() {
  usePageTitle('Pro Meta')
  const query = useQuery({
    queryKey: ['pro-meta'],
    queryFn: fetchProMeta,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  if (query.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="py-20 text-center text-muted">
        Pro meta stats are still being computed for the current patch. Check back shortly.
      </div>
    )
  }

  const data = query.data
  if (!data) return null
  if (data.totalMatches === 0) {
    return (
      <div className="py-20 text-center text-muted">
        Not enough tournament matches recorded yet for patch {data.patch.name}.
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-wrap items-center gap-3 font-dota">
        <Badge variant="pro">Patch {data.patch.name}</Badge>
        <span className="text-[13px] text-muted">
          {data.totalMatches} pro matches sampled
          {data.truncated ? ' (sample capped)' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border border-border p-4">
        <div>
          <StatBar
            label="Radiant Winrate"
            cell={{ winrate: data.aggregate.radiantWinrate, sample: data.totalMatches }}
            variant="radiant"
          />
          <StatBar
            label="Dire Winrate"
            cell={{ winrate: data.aggregate.direWinrate, sample: data.totalMatches }}
            variant="dire"
          />
        </div>
        <div>
          <StatBar
            label="First Pick Winrate"
            cell={{
              winrate: data.aggregate.firstPickWinrate,
              sample: data.aggregate.draftedMatches,
            }}
            variant="radiant"
          />
          <StatBar
            label="Second Pick Winrate"
            cell={{
              winrate: data.aggregate.secondPickWinrate,
              sample: data.aggregate.draftedMatches,
            }}
            variant="dire"
          />
        </div>
      </div>

      <ComboGrid {...data.combination} />
    </div>
  )
}
