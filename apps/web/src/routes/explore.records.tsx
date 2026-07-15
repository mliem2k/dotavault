import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'
import { formatDate, formatDuration, heroIconUrl } from '@/lib/utils'

export const Route = createFileRoute('/explore/records')({
  component: RecordsPage,
})

const RECORD_FIELDS = [
  { field: 'duration', label: 'Duration' },
  { field: 'kills', label: 'Kills' },
  { field: 'deaths', label: 'Deaths' },
  { field: 'assists', label: 'Assists' },
  { field: 'last_hits', label: 'Last Hits' },
  { field: 'denies', label: 'Denies' },
  { field: 'gold_per_min', label: 'GPM' },
  { field: 'xp_per_min', label: 'XPM' },
  { field: 'hero_damage', label: 'Hero Damage' },
  { field: 'hero_healing', label: 'Hero Healing' },
  { field: 'tower_damage', label: 'Tower Damage' },
] as const

function formatScore(field: string, score: number): string {
  return field === 'duration' ? formatDuration(score) : Math.round(score).toLocaleString()
}

function RecordsPage() {
  usePageTitle('Explore · Records')
  const [field, setField] = useState<(typeof RECORD_FIELDS)[number]['field']>('duration')

  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const records = useQuery({
    queryKey: ['records', field],
    queryFn: () => opendota.records(field),
    staleTime: 15 * 60 * 1000,
  })

  const heroMap = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, h])),
    [heroStats.data],
  )

  return (
    <div className="max-w-[900px] mx-auto space-y-3">
      <div className="flex flex-wrap gap-1 font-dota" role="tablist">
        {RECORD_FIELDS.map((f) => {
          const active = field === f.field
          return (
            <button
              key={f.field}
              type="button"
              role="tab"
              aria-current={active ? 'page' : undefined}
              onClick={() => setField(f.field)}
              className={`min-h-11 cursor-pointer px-3 py-1.5 text-[12px] uppercase tracking-[1px] border ${
                active ? 'bg-border border-gold text-foreground' : 'border-border text-muted'
              }`}
              style={{ background: active ? undefined : 'rgba(12,11,14,0.72)' }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
        <div
          className="px-4 py-3 uppercase text-foreground font-display border-b border-border"
          style={{ fontSize: 20, fontWeight: 500, letterSpacing: '3px' }}
        >
          {RECORD_FIELDS.find((f) => f.field === field)?.label}
        </div>
        <div className="px-4 py-3">
          {records.isPending || heroStats.isPending ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (records.data ?? []).length === 0 ? (
            <div className="py-8 text-center text-[14px] text-muted">No records available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-dota">
                <thead>
                  <tr className="text-[12px] font-bold uppercase tracking-widest text-muted">
                    <th className="pb-2 pr-2 text-right" style={{ width: 30 }}>
                      #
                    </th>
                    <th className="pb-2 px-2 text-left">Hero</th>
                    <th className="pb-2 px-2 text-right">Value</th>
                    <th className="pb-2 px-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(records.data ?? []).map((r, i) => {
                    const hero = heroMap.get(r.hero_id)
                    return (
                      <tr key={r.match_id} className="hover:bg-white/[0.03] border-t border-border">
                        <td className="py-1.5 pr-2 text-right text-[12px] tabular-nums text-muted">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1.5">
                          <a
                            href={`/match/${r.match_id}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            {hero && (
                              <img
                                src={heroIconUrl(hero.name)}
                                alt=""
                                loading="lazy"
                                className="h-6 w-6 rounded-sm"
                              />
                            )}
                            <span className="text-[14px] text-foreground">
                              {hero?.localized_name ?? `Hero ${r.hero_id}`}
                            </span>
                          </a>
                        </td>
                        <td className="px-2 text-right text-[14px] font-semibold tabular-nums text-gold">
                          {formatScore(field, r.score)}
                        </td>
                        <td className="px-2 text-right text-[13px] tabular-nums text-muted">
                          {formatDate(r.start_time)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
