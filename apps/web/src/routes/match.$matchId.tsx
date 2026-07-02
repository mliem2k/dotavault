import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AdvantageGraph } from '@/components/match/advantage_graph'
import { DraftPanel } from '@/components/match/draft_panel'
import { MatchChat } from '@/components/match/match_chat'
import { MatchPurchases } from '@/components/match/match_purchases'
import { MatchVision } from '@/components/match/match_vision'
import { ReplayViewer } from '@/components/match/replay_viewer'
import { Scoreboard } from '@/components/match/scoreboard'
import { Timeline } from '@/components/match/timeline'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
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

export const Route = createFileRoute('/match/$matchId')({
  component: MatchPage,
})

function MatchPage() {
  const { matchId } = Route.useParams()
  const [activeMinuteRaw, setActiveMinute] = useState<number | null>(null)

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
  const durationMinutes = m ? Math.floor(m.duration / 60) : 0
  const activeMinute = activeMinuteRaw ?? durationMinutes
  const idToName = new Map<number, string>(
    Object.entries(itemsData.data ?? {}).map(([name, { id }]) => [id, name]),
  )

  const radiantScore = m.players.filter((p) => p.player_slot < 128).reduce((s, p) => s + p.kills, 0)
  const direScore = m.players.filter((p) => p.player_slot >= 128).reduce((s, p) => s + p.kills, 0)


  const winColor = m.radiant_win ? '#92c93a' : '#c23c2a'
  const winTeam = m.radiant_win ? 'Radiant' : 'Dire'

  return (
    <div className="space-y-6">
      {/* Match header — Dota results style */}
      <div
        className="rounded-lg px-6 py-4"
        style={{ background: `linear-gradient(135deg, ${winColor}18 0%, #0f1e2e 50%)`, border: `1px solid ${winColor}30` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-bold tracking-wide mb-1" style={{ color: winColor }}>
              {winTeam} Victory
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold" style={{ color: '#92c93a' }}>{radiantScore}</span>
              <span className="text-lg text-muted">—</span>
              <span className="text-3xl font-bold" style={{ color: '#c23c2a' }}>{direScore}</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted space-y-1">
            <div className="text-sm text-foreground font-medium">{GAME_MODES[m.game_mode] ?? `Mode ${m.game_mode}`}</div>
            <div>Duration: <span className="text-foreground font-mono">{formatDuration(m.duration)}</span></div>
            <div>{formatTimeAgo(m.start_time)}</div>
            <div className="font-mono text-[10px]">#{m.match_id}</div>
          </div>
        </div>
      </div>

      {m.picks_bans && m.picks_bans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Draft</CardTitle>
          </CardHeader>
          {heroStats.data && <DraftPanel picksBans={m.picks_bans} heroStats={heroStats.data} />}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
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
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scoreboard</CardTitle>
            <span className="text-xs font-mono text-accent">
              At {formatDuration(activeMinute * 60)}
            </span>
          </div>
        </CardHeader>
        {heroStats.data ? (
          <Scoreboard
            players={m.players}
            heroStats={heroStats.data}
            radiantWin={m.radiant_win}
            idToName={idToName}
            activeMinute={activeMinute}
            durationMinutes={durationMinutes}
          />
        ) : (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Replay Viewer</CardTitle>
        </CardHeader>
        {heroStats.data && <ReplayViewer match={m} heroStats={heroStats.data} />}
      </Card>

      {heroStats.data && (m.players.some((p) => (p.obs_log?.length ?? 0) + (p.sen_log?.length ?? 0) > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Vision</CardTitle>
          </CardHeader>
          <MatchVision players={m.players} heroStats={heroStats.data} />
        </Card>
      )}

      {heroStats.data && (m.players.some((p) => (p.purchase_log?.length ?? 0) > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Purchases</CardTitle>
          </CardHeader>
          <MatchPurchases players={m.players} heroStats={heroStats.data} />
        </Card>
      )}

      {heroStats.data && m.chat && m.chat.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <MatchChat chat={m.chat} players={m.players} heroStats={heroStats.data} />
        </Card>
      )}
    </div>
  )
}
