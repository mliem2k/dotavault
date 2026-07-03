import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { MatchGraphs } from '@/components/match/match_graphs'
import { MatchOverview } from '@/components/match/match_overview'
import { MatchScoreboard } from '@/components/match/match_scoreboard'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'

type Tab = 'overview' | 'scoreboard' | 'graphs'

const TABS: Tab[] = ['overview', 'scoreboard', 'graphs']

export const Route = createFileRoute('/match/$matchId')({
  component: MatchPage,
})

function MatchPage() {
  const { matchId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('overview')

  const match = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => opendota.match(matchId),
  })

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  const itemsData = useQuery({
    queryKey: ['items_constants'],
    queryFn: () => opendota.items(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const abilitiesData = useQuery({
    queryKey: ['abilities_constants'],
    queryFn: () => opendota.abilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const abilityIdsData = useQuery({
    queryKey: ['ability_ids_constants'],
    queryFn: () => opendota.abilityIds(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (match.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!match.data) return <div className="text-sm text-muted">Match not found.</div>

  const m = match.data
  const itemConst = itemsData.data ?? {}
  const idToName = new Map<number, string>(
    Object.entries(itemConst).map(([name, { id }]) => [id, name]),
  )

  return (
    <div className="flex flex-col gap-0">
      {/* Tab strip — OVERVIEW / SCOREBOARD / GRAPHS, slash-separated like the client */}
      <div className="flex items-center pt-4 pb-3 pl-2" style={{ fontFamily: 'var(--font-dota)' }}>
        {TABS.map((t, i) => (
          <span key={t} className="flex items-center">
            {i > 0 && (
              <span className="mx-3 text-[15px]" style={{ color: '#3f464d' }}>/</span>
            )}
            <button
              type="button"
              onClick={() => setTab(t)}
              className="text-[16px] font-semibold uppercase cursor-pointer"
              style={{
                color: tab === t ? '#ffffff' : '#67757f',
                letterSpacing: '3px',
                borderBottom: tab === t ? '1px solid #ffffff' : '1px solid transparent',
                paddingBottom: 2,
              }}
            >
              {t}
            </button>
          </span>
        ))}
      </div>

      {tab === 'overview' &&
        (heroStats.data ? (
          <MatchOverview match={m} heroStats={heroStats.data} idToName={idToName} itemConst={itemConst} />
        ) : (
          <div className="flex justify-center py-12"><Spinner /></div>
        ))}

      {tab === 'scoreboard' &&
        (heroStats.data ? (
          <MatchScoreboard
            match={m}
            heroStats={heroStats.data}
            idToName={idToName}
            itemConst={itemConst}
            abilities={abilitiesData.data ?? {}}
            abilityIds={abilityIdsData.data ?? {}}
          />
        ) : (
          <div className="flex justify-center py-12"><Spinner /></div>
        ))}

      {tab === 'graphs' &&
        (heroStats.data ? (
          <MatchGraphs match={m} heroStats={heroStats.data} idToName={idToName} itemConst={itemConst} />
        ) : (
          <div className="flex justify-center py-12"><Spinner /></div>
        ))}
    </div>
  )
}
