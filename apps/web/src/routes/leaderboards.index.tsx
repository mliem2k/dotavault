import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /leaderboards (no region segment) always means Americas.
export const Route = createFileRoute('/leaderboards/')({
  beforeLoad: () => {
    throw redirect({ to: '/leaderboards/$region', params: { region: 'americas' } })
  },
})
