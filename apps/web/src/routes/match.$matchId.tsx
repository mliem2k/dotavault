import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AdvantageGraph } from '@/components/match/advantage_graph'
import { DraftPanel } from '@/components/match/draft_panel'
import { MatchChat } from '@/components/match/match_chat'
import { MatchOverview } from '@/components/match/match_overview'
import { MatchPurchases } from '@/components/match/match_purchases'
import { MatchVision } from '@/components/match/match_vision'
import { ReplayViewer } from '@/components/match/replay_viewer'
import { Timeline } from '@/components/match/timeline'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

const GAME_MODES: Record<number, string> = {
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  12: 'Least Played',
  16: 'Captains Draft',
  22: 'Ranked All Pick',
  23: 'Turbo',
}

type Tab = 'overview' | 'graphs' | 'draft' | 'chat' | 'vision' | 'purchases' | 'replay'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  graphs: 'Graphs',
  draft: 'Draft',
  chat: 'Chat',
  vision: 'Vision',
  purchases: 'Purchases',
  replay: 'Replay',
}

export const Route = createFileRoute('/match/$matchId')({
  component: MatchPage,
})

function MatchPage() {
  const { matchId } = Route.useParams()
  const [activeMinuteRaw, setActiveMinute] = useState<number | null>(null)
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

  if (match.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!match.data) return <div className="text-sm text-muted">Match not found.</div>

  const m = match.data
  const durationMinutes = Math.floor(m.duration / 60)
  const activeMinute = activeMinuteRaw ?? durationMinutes
  const idToName = new Map<number, string>(
    Object.entries(itemsData.data ?? {}).map(([name, { id }]) => [id, name]),
  )

  const radiantWin = m.radiant_win
  const winColor = radiantWin ? '#92c93a' : '#c23c2a'
  const loseColor = radiantWin ? '#c23c2a' : '#92c93a'
  const winTeam = radiantWin ? 'Radiant' : 'Dire'

  const isParsed = m.version !== null
  const hasVision = m.players.some((p) => (p.obs_log?.length ?? 0) + (p.sen_log?.length ?? 0) > 0)
  const hasChat = (m.chat?.length ?? 0) > 0
  const hasPurchases = m.players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  const hasDraft = (m.picks_bans?.length ?? 0) > 0

  const availableTabs: Tab[] = [
    'overview',
    'graphs',
    ...(hasDraft ? ['draft' as Tab] : []),
    ...(hasChat ? ['chat' as Tab] : []),
    ...(hasVision ? ['vision' as Tab] : []),
    ...(hasPurchases ? ['purchases' as Tab] : []),
    'replay',
  ]

  const activeTab = availableTabs.includes(tab) ? tab : 'overview'

  return (
    <div className="flex flex-col gap-0">
      {/* Match header */}
      <div className="px-4 pt-4 pb-3" style={{ background: '#0d1820', borderBottom: '1px solid #1a2e40' }}>
        <div className="flex items-start justify-between gap-6 max-w-full">
          {/* Winner + scores */}
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: winColor }}>
                {winTeam} Victory
              </div>
              <div className="flex items-center gap-3 text-sm" style={{ color: '#5a7a94' }}>
                <span>{GAME_MODES[m.game_mode] ?? `Mode ${m.game_mode}`}</span>
                <span>·</span>
                <span className="font-mono">{formatDuration(m.duration)}</span>
                <span>·</span>
                <span>{formatTimeAgo(m.start_time)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold tabular-nums" style={{ color: '#92c93a' }}>
                {m.radiant_score}
              </span>
              <span className="text-xl font-light" style={{ color: '#2a3a4a' }}>—</span>
              <span className="text-4xl font-bold tabular-nums" style={{ color: '#c23c2a' }}>
                {m.dire_score}
              </span>
            </div>
          </div>

          {/* Match metadata */}
          <div className="text-right space-y-0.5">
            <div className="text-[10px] uppercase tracking-wide" style={{ color: '#5a7a94' }}>Match ID</div>
            <div className="font-mono text-sm" style={{ color: '#c8d6e5' }}>#{m.match_id}</div>
            {!isParsed && (
              <div
                className="text-[10px] px-1.5 py-0.5 rounded inline-block"
                style={{ background: '#2a1810', color: '#d4a843', border: '1px solid #3a2820' }}
              >
                Unparsed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-end gap-0 px-4 overflow-x-auto"
        style={{ background: '#0d1820', borderBottom: '1px solid #1a2e40' }}
      >
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors shrink-0"
            style={{
              color: activeTab === t ? '#c8d6e5' : '#5a7a94',
              borderBottom: activeTab === t ? '2px solid #d4a843' : '2px solid transparent',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          heroStats.data ? (
            <MatchOverview match={m} heroStats={heroStats.data} idToName={idToName} />
          ) : (
            <div className="flex justify-center py-12"><Spinner /></div>
          )
        )}

        {activeTab === 'graphs' && (
          <div className="space-y-4 max-w-4xl">
            <AdvantageGraph
              radiantGoldAdv={m.radiant_gold_adv}
              radiantXpAdv={m.radiant_xp_adv}
              players={m.players}
              heroStats={heroStats.data}
              activeMinute={activeMinute}
            />
            {heroStats.data && (
              <Timeline
                match={m}
                heroStats={heroStats.data}
                activeMinute={activeMinute}
                onMinuteChange={setActiveMinute}
              />
            )}
          </div>
        )}

        {activeTab === 'draft' && hasDraft && heroStats.data && (
          <div className="max-w-3xl">
            <DraftPanel picksBans={m.picks_bans!} heroStats={heroStats.data} />
          </div>
        )}

        {activeTab === 'chat' && hasChat && heroStats.data && (
          <div className="max-w-2xl">
            <MatchChat chat={m.chat!} players={m.players} heroStats={heroStats.data} />
          </div>
        )}

        {activeTab === 'vision' && hasVision && heroStats.data && (
          <MatchVision players={m.players} heroStats={heroStats.data} />
        )}

        {activeTab === 'purchases' && hasPurchases && heroStats.data && (
          <div className="max-w-2xl">
            <MatchPurchases players={m.players} heroStats={heroStats.data} />
          </div>
        )}

        {activeTab === 'replay' && heroStats.data && (
          <ReplayViewer match={m} heroStats={heroStats.data} />
        )}
      </div>
    </div>
  )
}
