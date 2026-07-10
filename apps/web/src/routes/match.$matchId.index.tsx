import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /match/:matchId (no tab segment) always means the overview tab.
export const Route = createFileRoute('/match/$matchId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/match/$matchId/$tab',
      params: { matchId: params.matchId, tab: 'overview' },
    })
  },
})
