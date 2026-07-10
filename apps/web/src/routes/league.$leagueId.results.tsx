import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { LeagueTabBar } from '@/components/league/league_tab_bar'
import { Panel } from '@/components/league/panel'

export const Route = createFileRoute('/league/$leagueId/results')({
  component: ResultsLayout,
})

function ResultsLayout() {
  const { leagueId } = Route.useParams()
  const { pathname } = useLocation()
  const activeView = pathname.endsWith('/bracket') ? 'bracket' : 'list'
  const btnClass = (view: 'list' | 'bracket') =>
    `px-2.5 py-3 text-[11px] font-bold uppercase cursor-pointer ${
      activeView === view ? 'bg-gold text-background' : 'text-muted'
    }`
  const btnStyle = (view: 'list' | 'bracket') => ({
    background: activeView === view ? undefined : 'rgba(255,255,255,0.05)',
    letterSpacing: '1px',
  })

  return (
    <div>
      <LeagueTabBar leagueId={leagueId} active="results" />
      <div className={activeView === 'list' ? 'max-w-[720px] mx-auto' : undefined}>
        <Panel
          title="Results"
          action={
            <div className="flex items-center gap-1">
              <Link
                to="/league/$leagueId/results/$view"
                params={{ leagueId, view: 'list' }}
                aria-current={activeView === 'list' ? 'page' : undefined}
                className={btnClass('list')}
                style={btnStyle('list')}
              >
                list
              </Link>
              <Link
                to="/league/$leagueId/results/$view"
                params={{ leagueId, view: 'bracket' }}
                aria-current={activeView === 'bracket' ? 'page' : undefined}
                className={btnClass('bracket')}
                style={btnStyle('bracket')}
              >
                bracket
              </Link>
            </div>
          }
        >
          <Outlet />
        </Panel>
      </div>
    </div>
  )
}
