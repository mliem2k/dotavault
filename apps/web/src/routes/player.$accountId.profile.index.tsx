import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare /player/:accountId/profile (no feed segment) always means Recent Games.
export const Route = createFileRoute('/player/$accountId/profile/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/player/$accountId/profile/$feed',
      params: { accountId: params.accountId, feed: 'recent' },
    })
  },
})
