import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { Navbar } from '@/components/layout/navbar'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    // No background here — let the body's greyfade texture show through.
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  ),
})
