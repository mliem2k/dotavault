import { Link } from '@tanstack/react-router'

export type LeagueTab = 'standings' | 'results' | 'draft' | 'participants'

export function LeagueTabBar({ leagueId, active }: { leagueId: string; active: LeagueTab }) {
  // #a8a294 (inactive tab text) has no match in the Token Mapping Reference (not the same
  // shade as text-muted's #8a8474/#5a5648), so it is kept as a raw inline style rather than
  // guessed at, per the Task 5/6 precedent for off-table hex values.
  const tabClassName = (key: LeagueTab) =>
    `px-4 py-3.5 text-[14px] font-semibold uppercase cursor-pointer whitespace-nowrap${
      active === key ? ' bg-gold text-background' : ''
    }`
  const tabStyle = (key: LeagueTab) => ({
    color: active === key ? undefined : '#a8a294',
    letterSpacing: '2px',
  })
  return (
    <div
      className="flex items-center flex-wrap gap-1 mb-4 px-1 py-1 border border-border font-dota"
      style={{ background: 'rgba(8,10,12,0.55)' }}
    >
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'standings' }}
        className={tabClassName('standings')}
        style={tabStyle('standings')}
        aria-current={active === 'standings' ? 'page' : undefined}
      >
        Standings
      </Link>
      <Link
        to="/league/$leagueId/results"
        params={{ leagueId }}
        className={tabClassName('results')}
        style={tabStyle('results')}
        aria-current={active === 'results' ? 'page' : undefined}
      >
        Results
      </Link>
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'draft' }}
        className={tabClassName('draft')}
        style={tabStyle('draft')}
        aria-current={active === 'draft' ? 'page' : undefined}
      >
        Draft
      </Link>
      <Link
        to="/league/$leagueId/$tab"
        params={{ leagueId, tab: 'participants' }}
        className={tabClassName('participants')}
        style={tabStyle('participants')}
        aria-current={active === 'participants' ? 'page' : undefined}
      >
        Participants
      </Link>
    </div>
  )
}
