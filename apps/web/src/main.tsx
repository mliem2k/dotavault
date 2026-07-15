import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

// Route chunks are content-hashed per deploy, and every deploy changes the
// hash of every chunk transitively (even files that didn't change get a new
// hash if a sibling chunk they reference did). A tab left open across a
// deploy holds references to hashes that no longer exist, and dynamically
// importing a not-yet-visited route then fails. Reload once to pick up the
// current build; the sessionStorage guard stops a real, persistent failure
// from reload-looping forever.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('reloaded-after-preload-error')) return
  sessionStorage.setItem('reloaded-after-preload-error', '1')
  window.location.reload()
})

const router = createRouter({ routeTree, context: { queryClient }, defaultPendingMs: 300 })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
