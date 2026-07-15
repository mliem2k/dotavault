import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { aggregateScenarioWinRates } from '@/lib/scenario_aggregation'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/explore/scenarios')({
  component: ScenariosPage,
})

const SCENARIO_LABELS: Record<string, string> = {
  courier_kill: 'Win Rate After Killing Enemy Courier',
  first_blood: 'Win Rate With First Blood',
  pos_chat_1min: 'Win Rate With Positive Chat in First Minute',
  neg_chat_1min: 'Win Rate With Negative Chat in First Minute',
}

function ScenariosPage() {
  usePageTitle('Explore · Scenario Win Rates')
  const query = useQuery({
    queryKey: ['scenarios_misc'],
    queryFn: () => opendota.scenariosMisc(),
    staleTime: 60 * 60 * 1000,
  })

  const summaries = useMemo(() => aggregateScenarioWinRates(query.data ?? []), [query.data])

  if (query.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-[1040px] mx-auto grid grid-cols-1 gap-4 sm:grid-cols-2">
      {summaries.map((s) => (
        <div
          key={s.scenario}
          className="border border-border p-4"
          style={{ background: 'rgba(12,11,14,0.72)' }}
        >
          <div className="text-[13px] uppercase text-muted tracking-[1px] mb-2 font-dota">
            {SCENARIO_LABELS[s.scenario] ?? s.scenario}
          </div>
          <div
            className={`text-[32px] font-bold tabular-nums font-dota ${
              s.winRate >= 52 ? 'text-radiant' : s.winRate < 48 ? 'text-dire' : 'text-foreground'
            }`}
          >
            {s.winRate.toFixed(1)}%
          </div>
          <div className="text-[12px] text-muted font-dota mt-1">
            {s.games.toLocaleString()} games sampled
          </div>
        </div>
      ))}
    </div>
  )
}
