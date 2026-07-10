import { createFileRoute, Outlet } from '@tanstack/react-router'

// Layout for /match/$matchId/* — the actual tabs live in match.$matchId.$tab
// and the bare-path redirect lives in match.$matchId.index, so this stays a
// pure pass-through (a beforeLoad redirect here would fire for every child
// match too, breaking direct links to any specific tab).
export const Route = createFileRoute('/match/$matchId')({
  component: () => <Outlet />,
})
