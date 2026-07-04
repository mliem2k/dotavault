export const RANK_NAMES = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']

export function rankName(rankTier: number | null): string {
  if (!rankTier) return 'Unranked'
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier === 8) return 'Immortal'
  return `${RANK_NAMES[tier] ?? 'Unknown'}${stars ? ` ${stars}` : ''}`
}

export function rankBadge(rankTier: number | null): { medal: string; stars: string | null } | null {
  if (!rankTier) return null
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  if (tier < 1 || tier > 8) return null
  return {
    medal: `/ranks/rank_icon_${tier}.webp`,
    stars: tier < 8 && stars > 0 ? `/ranks/rank_star_${stars}.webp` : null,
  }
}
