import { Link } from '@tanstack/react-router'

export type LeagueTab = 'standings' | 'results' | 'draft' | 'participants'

export function LeagueTabBar({ leagueId, active }: { leagueId: string; active: LeagueTab }) {
  const className = 'px-4 py-3.5 text-[14px] font-semibold uppercase cursor-pointer whitespace-nowrap'
  const style = (key: LeagueTab) => ({
    color: active === key ? '#0b0b0d' : '#a8a294',
    background: active === key ? '#c9a94a' : 'transparent',
    letterSpacing: '2px',
  })
  return (
    <div
      className="flex items-center flex-wrap gap-1 mb-4 px-1 py-1"
      style={{ fontFamily: 'var(--font-dota)', background: 'rgba(8,10,12,0.55)', border: '1px solid #24222a' }}
    >
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'standings' }}
        className={className}
        style={style('standings')}
        aria-current={active === 'standings' ? 'page' : undefined}
      >
        Standings
      </Link>
      <Link
        to="/league/$leagueId/results"
        params={{ leagueId }}
        className={className}
        style={style('results')}
        aria-current={active === 'results' ? 'page' : undefined}
      >
        Results
      </Link>
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'draft' }}
        className={className}
        style={style('draft')}
        aria-current={active === 'draft' ? 'page' : undefined}
      >
        Draft
      </Link>
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'participants' }}
        className={className}
        style={style('participants')}
        aria-current={active === 'participants' ? 'page' : undefined}
      >
        Participants
      </Link>
    </div>
  )
}
