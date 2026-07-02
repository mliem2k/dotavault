import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hero/$heroId')({
  component: () => <div className="text-sm text-muted">Hero</div>,
})
