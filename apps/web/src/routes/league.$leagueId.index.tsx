import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /league/:leagueId (no tab segment) always means the standings tab.
export const Route = createFileRoute('/league/$leagueId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/league/$leagueId/$tab', params: { leagueId: params.leagueId, tab: 'standings' } })
  },
})
