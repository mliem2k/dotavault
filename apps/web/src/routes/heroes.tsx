import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/heroes')({
  component: () => <div className="text-sm text-muted">Heroes</div>,
})
