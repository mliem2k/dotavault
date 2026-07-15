import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/explore')({
  component: ExploreLayout,
})

const tabLinkClass = (active: boolean) =>
  `inline-flex items-center justify-center min-h-[44px] text-[13px] font-semibold uppercase transition-colors px-4 ${
    active ? '' : 'hover:bg-white/[0.03] hover:text-foreground'
  }`
const tabLinkStyle = (active: boolean) => ({
  background: active ? 'var(--color-gold)' : 'transparent',
  color: active ? 'var(--color-background)' : 'var(--color-muted)',
  letterSpacing: '1.5px',
})

function ExploreLayout() {
  usePageTitle('Explore')
  const { pathname } = useLocation()
  const isRecords = pathname === '/explore' || pathname.startsWith('/explore/records')

  return (
    <div className="flex flex-col gap-0 font-dota">
      <div
        className="flex items-center gap-1 flex-wrap mt-3 mb-3 px-3 py-2.5"
        style={{ background: 'rgba(8,10,12,0.55)' }}
      >
        <Link
          to="/explore/records"
          className={tabLinkClass(isRecords)}
          style={tabLinkStyle(isRecords)}
        >
          Records
        </Link>
        <Link
          to="/explore/distributions"
          className={tabLinkClass(pathname.startsWith('/explore/distributions'))}
          style={tabLinkStyle(pathname.startsWith('/explore/distributions'))}
        >
          Distributions
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
