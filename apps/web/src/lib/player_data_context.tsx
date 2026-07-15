import type { UseQueryResult } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type { HeroStat } from 'types'
import type { Division } from '@/lib/leaderboard'
import type { opendota } from '@/lib/opendota'
import type { rankBadge } from '@/lib/rank'

export type PlayerData = {
  accountId: string
  p: {
    profile: { personaname: string; account_id: number }
    rank_tier: number | null
    aliases?: { personaname: string | null; name_since: string }[]
  }
  wl: { win: number; lose: number }
  badge: ReturnType<typeof rankBadge>
  heroesPlayed: number
  heroMap: Map<number, HeroStat>
  featured: { hero_id: string | number; games: number }[]
  leaderboardPos: UseQueryResult<{ division: Division; rank: number } | null>
  heroStats: UseQueryResult<HeroStat[]>
  matches: UseQueryResult<Awaited<ReturnType<typeof opendota.playerMatches>>>
  matchesLeagueInfo: UseQueryResult<Awaited<ReturnType<typeof opendota.matchesLeagueInfo>>>
  playerHeroes: UseQueryResult<Awaited<ReturnType<typeof opendota.playerHeroes>>>
  totals: UseQueryResult<Awaited<ReturnType<typeof opendota.playerTotals>>>
  peers: UseQueryResult<Awaited<ReturnType<typeof opendota.playerPeers>>>
  countsQ: UseQueryResult<Awaited<ReturnType<typeof opendota.playerCounts>>>
  heroRankings: UseQueryResult<Awaited<ReturnType<typeof opendota.playerHeroRankings>>>
}

export const PlayerDataContext = createContext<PlayerData | null>(null)

export function usePlayerData(): PlayerData {
  const ctx = useContext(PlayerDataContext)
  if (!ctx) throw new Error('usePlayerData must be used within a /player/$accountId route')
  return ctx
}
