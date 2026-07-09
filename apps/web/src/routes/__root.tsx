import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { Navbar } from '@/components/layout/navbar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    // No background here — let the body's greyfade texture show through.
    <TooltipProvider>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto w-full max-w-[1800px] px-6 py-8">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  ),
})
