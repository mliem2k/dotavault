import type { Player, PlayerWL } from 'types'
import { Badge } from '@/components/ui/badge'
import { winRate } from '@/lib/utils'

const RANK_NAMES = [
  '', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal',
]

function rankName(rankTier: number | null): string {
  if (!rankTier) return 'Unranked'
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier === 8) return 'Immortal'
  return `${RANK_NAMES[tier] ?? 'Unknown'} ${stars}★`
}

const RANK_CDN = 'https://www.opendota.com/assets/images/dota2/rank_icons'

function rankBadge(rankTier: number | null): { medal: string; stars: string | null } | null {
  if (!rankTier) return null
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier < 1 || tier > 8) return null
  return {
    medal: `${RANK_CDN}/rank_icon_${tier}.png`,
    stars: tier < 8 && stars > 0 ? `${RANK_CDN}/rank_star_${stars}.png` : null,
  }
}

type ProTeamInfo = {
  team_id: number
  team_name: string
  team_tag: string
  team_logo: string | null
}

export function PlayerHeader({
  player,
  wl,
  proTeam,
}: {
  player: Player
  wl: PlayerWL
  proTeam?: ProTeamInfo
}) {
  const total = wl.win + wl.lose
  const badge = rankBadge(player.rank_tier)

  return (
    <div className="flex items-start gap-4">
      <img
        src={player.profile.avatarfull}
        alt={player.profile.personaname}
        className="h-16 w-16 rounded-lg flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">{player.profile.personaname}</h1>
          {proTeam && (
            <a
              href={`/team/${proTeam.team_id}`}
              className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground hover:border-muted transition-colors"
            >
              {proTeam.team_logo && (
                <img src={proTeam.team_logo} alt={proTeam.team_name} className="h-4 w-4 rounded-sm object-contain" />
              )}
              <span>{proTeam.team_tag}</span>
              <span className="text-muted/60">·</span>
              <span>{proTeam.team_name}</span>
            </a>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {badge && (
            <div className="relative h-9 w-9 flex-shrink-0">
              <img src={badge.medal} alt={rankName(player.rank_tier)} className="h-9 w-9 object-contain" />
              {badge.stars && (
                <img src={badge.stars} alt="" className="absolute inset-0 h-9 w-9 object-contain" />
              )}
            </div>
          )}
          <div>
            <div className="text-sm font-medium">{rankName(player.rank_tier)}</div>
            {player.leaderboard_rank && (
              <div className="text-xs text-accent">#{player.leaderboard_rank} leaderboard</div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <div>
            <div className="font-mono text-lg text-radiant">{wl.win}</div>
            <div className="text-xs text-muted">Wins</div>
          </div>
          <div>
            <div className="font-mono text-lg text-dire">{wl.lose}</div>
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
