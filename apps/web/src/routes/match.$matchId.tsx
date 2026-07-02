import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/match/$matchId')({
  component: () => <div className="text-sm text-muted">Match</div>,
})
