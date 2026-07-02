import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/player/$accountId')({
  component: () => <div className="text-sm text-muted">Player</div>,
})
