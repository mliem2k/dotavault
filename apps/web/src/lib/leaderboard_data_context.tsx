import { createContext, useContext } from 'react'
import type { LeaderboardEntry } from '@/lib/leaderboard'

export type ProRef = {
  name: string
  personaname: string | null
  account_id: number
  team_id: number | null
}

export type LeaderboardData = {
  search: string
  setSearch: (v: string) => void
  page: number
  setPage: (updater: (p: number) => number) => void
  proFor: (r: LeaderboardEntry) => ProRef | undefined
}

export const LeaderboardDataContext = createContext<LeaderboardData | null>(null)

export function useLeaderboardData(): LeaderboardData {
  const ctx = useContext(LeaderboardDataContext)
  if (!ctx) throw new Error('useLeaderboardData must be used within a /leaderboards route')
  return ctx
}
