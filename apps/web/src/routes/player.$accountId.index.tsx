import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /player/:accountId (no tab segment) always means the profile tab.
export const Route = createFileRoute('/player/$accountId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/player/$accountId/profile', params: { accountId: params.accountId } })
  },
})
