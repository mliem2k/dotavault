import type { Player, PlayerWL } from 'types'
import { Badge } from '@/components/ui/badge'
import { winRate } from '@/lib/utils'

const RANK_NAMES = [
  '',
  'Herald',
  'Guardian',
  'Crusader',
  'Archon',
  'Legend',
  'Ancient',
  'Divine',
  'Immortal',
]

function rankName(rankTier: number | null): string {
  if (!rankTier) return 'Unranked'
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier === 8) return 'Immortal'
  return `${RANK_NAMES[tier] ?? 'Unknown'} ${stars}★`
}

export function PlayerHeader({ player, wl }: { player: Player; wl: PlayerWL }) {
  const total = wl.win + wl.lose
  return (
    <div className="flex items-start gap-4">
      <img
        src={player.profile.avatarfull}
        alt={player.profile.personaname}
        className="h-16 w-16 rounded-lg"
      />
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{player.profile.personaname}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge>{rankName(player.rank_tier)}</Badge>
          {player.leaderboard_rank && <Badge>#{player.leaderboard_rank}</Badge>}
        </div>
        <div className="mt-3 flex gap-6 text-sm">
          <div>
            <div className="font-mono text-lg text-foreground">{wl.win}</div>
            <div className="text-xs text-muted">Wins</div>
          </div>
          <div>
            <div className="font-mono text-lg text-foreground">{wl.lose}</div>
            <div className="text-xs text-muted">Losses</div>
          </div>
          <div>
            <div className="font-mono text-lg text-foreground">{winRate(wl.win, total)}</div>
            <div className="text-xs text-muted">Win Rate</div>
          </div>
          {player.mmr_estimate && (
            <div>
              <div className="font-mono text-lg text-foreground">
                ~{player.mmr_estimate.estimate}
              </div>
              <div className="text-xs text-muted">Est. MMR</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
