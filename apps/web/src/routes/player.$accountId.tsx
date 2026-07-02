import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HeroStatsTable } from '@/components/player/hero_stats_table'
import { LifetimeStats, PlayStyleRadar } from '@/components/player/play_style_radar'
import { RecentGames } from '@/components/player/recent_games'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { winRate } from '@/lib/utils'

export const Route = createFileRoute('/player/$accountId')({
  component: PlayerPage,
})

const RANK_NAMES = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']

function rankName(rankTier: number | null): string {
  if (!rankTier) return 'Unranked'
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier === 8) return 'Immortal'
  return `${RANK_NAMES[tier] ?? 'Unknown'}${stars ? ` ${stars}` : ''}`
}

function rankBadge(rankTier: number | null): { medal: string; stars: string | null } | null {
  if (!rankTier) return null
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier < 1 || tier > 8) return null
  return {
    medal: `/ranks/rank_icon_${tier}.webp`,
    stars: tier < 8 && stars > 0 ? `/ranks/rank_star_${stars}.webp` : null,
  }
}

type Tab = 'profile' | 'heroes'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#100e0b', border: '1px solid #1c1810' }}>
      <div
        className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: '#77715f', fontFamily: 'var(--font-dota)', borderBottom: '1px solid #241f16' }}
      >
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function PlayerPage() {
  const { accountId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('profile')

  const player = useQuery({
    queryKey: ['player', accountId],
    queryFn: async () => {
      const [player, wl] = await Promise.all([opendota.player(accountId), opendota.playerWL(accountId)])
      return { player, wl }
    },
  })
  const matches = useQuery({
    queryKey: ['player_matches', accountId],
    queryFn: () => opendota.playerMatches(accountId, 40),
  })
  const playerHeroes = useQuery({
    queryKey: ['player_heroes', accountId],
    queryFn: () => opendota.playerHeroes(accountId),
  })
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const totals = useQuery({
    queryKey: ['player_totals', accountId],
    queryFn: () => opendota.playerTotals(accountId),
    staleTime: 10 * 60 * 1000,
  })

  if (player.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!player.data) return <div className="text-sm text-muted">Player not found.</div>

  const p = player.data.player
  const wl = player.data.wl
  const totalGames = wl.win + wl.lose
  const badge = rankBadge(p.rank_tier)
  const heroesPlayed = (playerHeroes.data ?? []).filter((h) => h.games > 0).length
  const mmr = p.mmr_estimate?.estimate ?? p.competitive_rank ?? null

  const metric = (value: string, label: string) => (
    <div>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}>
        {label}
      </div>
      <div className="text-[22px] font-bold leading-tight" style={{ color: '#ece6d8', fontFamily: 'var(--font-dota)' }}>
        {value}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ background: '#0e0c0a', borderBottom: '1px solid #2c2820' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <img
            src={p.profile.avatarfull}
            alt={p.profile.personaname}
            className="h-16 w-16 rounded"
            style={{ border: '1px solid #2c2820' }}
          />
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight truncate" style={{ color: '#f0eae0', fontFamily: 'var(--font-dota)' }}>
              {p.profile.personaname}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {badge && (
                <div className="relative h-8 w-8 shrink-0">
                  <img src={badge.medal} alt="" className="h-8 w-8 object-contain" />
                  {badge.stars && <img src={badge.stars} alt="" className="absolute inset-0 h-8 w-8 object-contain" />}
                </div>
              )}
              <span className="text-[13px] uppercase tracking-wider" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                {rankName(p.rank_tier)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 ml-auto">
            {mmr != null && metric(mmr.toLocaleString(), 'MMR est.')}
            {metric(totalGames.toLocaleString(), 'Matches')}
            {metric(winRate(wl.win, totalGames), 'Win Rate')}
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}>Friend ID</div>
              <div className="font-mono text-sm mt-1.5" style={{ color: '#9a8f66' }}>{p.profile.account_id}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0 px-2" style={{ background: '#0e0c0a', borderBottom: '1px solid #2c2820' }}>
        {(['profile', 'heroes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[13px] font-semibold uppercase tracking-widest transition-colors"
            style={{
              color: tab === t ? '#dcd6c8' : '#4a4436',
              borderBottom: tab === t ? '2px solid #c9a94a' : '2px solid transparent',
              fontFamily: 'var(--font-dota)',
            }}
          >
            {t === 'profile' ? 'Profile' : 'Heroes'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-4">
            {/* Left: play style + lifetime */}
            <Panel title="Play Style · Lifetime Stats">
              {totals.isPending ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : totals.data ? (
                <div className="flex gap-4 items-center flex-wrap">
                  <div className="flex-1 min-w-[220px] flex justify-center">
                    <PlayStyleRadar totals={totals.data} heroesPlayed={heroesPlayed} />
                  </div>
                  <div className="shrink-0">
                    <LifetimeStats totals={totals.data} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">No stats available.</p>
              )}
            </Panel>

            {/* Right: recent games */}
            <div>
              <div
                className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}
              >
                Recent Games
              </div>
              {matches.isPending || heroStats.isPending ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : matches.data && heroStats.data ? (
                <RecentGames matches={matches.data} heroStats={heroStats.data} />
              ) : null}
            </div>
          </div>
        )}

        {tab === 'heroes' && (
          <Panel title="Most Played Heroes">
            {playerHeroes.isPending || heroStats.isPending ? (
              <Spinner />
            ) : playerHeroes.data && heroStats.data ? (
              <HeroStatsTable playerHeroes={playerHeroes.data} heroStats={heroStats.data} />
            ) : null}
          </Panel>
        )}
      </div>
    </div>
  )
}
