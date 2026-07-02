import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AdvantageGraph } from '@/components/match/advantage_graph'
import { DraftPanel } from '@/components/match/draft_panel'
import { MatchChat } from '@/components/match/match_chat'
import { MatchOverview } from '@/components/match/match_overview'
import { MatchScoreboard } from '@/components/match/match_scoreboard'
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

type Tab = 'overview' | 'scoreboard' | 'graphs' | 'draft' | 'chat' | 'vision' | 'purchases' | 'replay'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  scoreboard: 'Scoreboard',
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
    'scoreboard',
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
      <div className="px-4 pt-4 pb-3" style={{ background: '#060f1c', borderBottom: '1px solid #1a2e45' }}>
        <div className="flex items-start justify-between gap-6 max-w-full">
          {/* Winner + scores */}
          <div className="flex items-center gap-8">
            <div>
              <div
                className="text-[26px] font-bold mb-0.5 uppercase tracking-wide"
                style={{ color: winColor, fontFamily: 'var(--font-dota)' }}
              >
                {winTeam} Victory
              </div>
              <div
                className="flex items-center gap-2 text-[13px]"
                style={{ color: '#4a6a84', fontFamily: 'var(--font-dota)' }}
              >
                <span>{GAME_MODES[m.game_mode] ?? `Mode ${m.game_mode}`}</span>
                <span style={{ color: '#1a3040' }}>·</span>
                <span className="font-mono">{formatDuration(m.duration)}</span>
                <span style={{ color: '#1a3040' }}>·</span>
                <span>{formatTimeAgo(m.start_time)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span
                className="tabular-nums"
                style={{ fontSize: '48px', lineHeight: 1, fontWeight: 700, color: '#92c93a', fontFamily: 'var(--font-dota)' }}
              >
                {m.radiant_score}
              </span>
              <span className="text-2xl font-light" style={{ color: '#1a3040' }}>—</span>
              <span
                className="tabular-nums"
                style={{ fontSize: '48px', lineHeight: 1, fontWeight: 700, color: '#c23c2a', fontFamily: 'var(--font-dota)' }}
              >
                {m.dire_score}
              </span>
            </div>
          </div>

          {/* Match metadata */}
          <div className="text-right space-y-0.5">
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#2a4a5a', fontFamily: 'var(--font-dota)' }}
            >
              Match ID
            </div>
            <div className="font-mono text-sm" style={{ color: '#4a7a9a' }}>#{m.match_id}</div>
            {!isParsed && (
              <div
                className="text-[10px] px-1.5 py-0.5 rounded inline-block mt-1"
                style={{ background: '#1e1008', color: '#e8a832', border: '1px solid #3a2810', fontFamily: 'var(--font-dota)' }}
              >
                Unparsed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-end gap-0 px-2 overflow-x-auto"
        style={{ background: '#060f1c', borderBottom: '1px solid #1a2e45' }}
      >
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-widest transition-colors shrink-0"
            style={{
              color: activeTab === t ? '#c8d6e5' : '#2a4a5a',
              borderBottom: activeTab === t ? '2px solid #e8a832' : '2px solid transparent',
              fontFamily: 'var(--font-dota)',
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
            <MatchOverview match={m} heroStats={heroStats.data} />
          ) : (
            <div className="flex justify-center py-12"><Spinner /></div>
          )
        )}

        {activeTab === 'scoreboard' && (
          heroStats.data ? (
            <MatchScoreboard match={m} heroStats={heroStats.data} idToName={idToName} />
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
