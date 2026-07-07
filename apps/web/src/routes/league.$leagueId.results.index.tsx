import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /league/:leagueId/results (no view segment) always means the list view.
export const Route = createFileRoute('/league/$leagueId/results/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/league/$leagueId/results/$view',
      params: { leagueId: params.leagueId, view: 'list' },
    })
  },
})
