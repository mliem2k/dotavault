import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pro')({
  component: () => <div className="text-sm text-muted">Pro</div>,
})
