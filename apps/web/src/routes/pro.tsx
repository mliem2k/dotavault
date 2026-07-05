import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { countryFlagUrl, findLeaderboardPositions } from '@/lib/leaderboard'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/pro')({
  component: ProPage,
})

/* Pro scene page: recent professional series results with winners and
   scores (filterable by league, load more), team ratings, and notable
   players. Data: OpenDota proMatches / teams / proPlayers. */

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="flex items-center justify-between px-4 py-3 uppercase"
        style={{
          color: '#c8c2b4',
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
          borderBottom: '1px solid #24222a',
        }}
      >
        <span>{title}</span>
        {right}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function TeamName({ name, won }: { name: string; won: boolean }) {
  return (
    <span
      className="truncate text-[16px]"
      style={{
        color: won ? '#8ec63f' : '#a09a8c',
        fontFamily: 'var(--font-dota)',
        fontWeight: won ? 600 : 400,
      }}
    >
      {name}
    </span>
  )
}

function ProMatches() {
  const [league, setLeague] = useState('')
  const query = useInfiniteQuery({
    queryKey: ['pro_matches_feed'],
    queryFn: ({ pageParam }) => opendota.proMatches(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length ? last[last.length - 1].match_id : undefined),
    staleTime: 60 * 1000,
  })

  const rows = useMemo(() => {
    const all = (query.data?.pages ?? []).flat()
    const q = league.trim().toLowerCase()
    return q ? all.filter((m) => (m.league_name ?? '').toLowerCase().includes(q)) : all
  }, [query.data, league])

  return (
    <Panel
      title="Recent Pro Matches"
      right={
        <input
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          placeholder="Filter league..."
          className="px-2 py-1 text-[13px] normal-case outline-none"
          style={{
            background: 'rgba(8,10,12,0.7)',
            border: '1px solid #24222a',
            color: '#dcd6c8',
            fontFamily: 'var(--font-dota)',
            letterSpacing: 'normal',
            width: 170,
          }}
        />
      }
    >
      {query.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      <div>
        {rows.map((m, i) => {
          const radWon = m.radiant_win === true
          return (
            <a
              key={m.match_id}
              href={`/match/${m.match_id}`}
              className="flex items-center gap-3 py-2.5 hover:bg-white/[0.03]"
              style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamName name={m.radiant_name ?? 'Radiant'} won={radWon} />
                  <span
                    className="shrink-0 px-1.5 text-[14px] tabular-nums"
                    style={{ color: '#dcd6c8', background: 'rgba(255,255,255,0.05)', fontFamily: 'var(--font-dota)' }}
                  >
                    {m.radiant_score ?? '?'} : {m.dire_score ?? '?'}
                  </span>
                  <TeamName name={m.dire_name ?? 'Dire'} won={!radWon} />
                </div>
                {m.league_name && (
                  <div className="mt-0.5 truncate text-[13px]" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
                    {m.league_name}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                  {formatTimeAgo(m.start_time)}
                </div>
                <div className="mt-0.5 text-[13px] tabular-nums" style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}>
                  {formatDuration(m.duration)}
                </div>
              </div>
            </a>
          )
        })}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="px-5 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:opacity-50"
            style={{
              background: '#1a2024',
              border: '1px solid #2c3236',
              color: '#cfd4d8',
              letterSpacing: '1px',
              fontFamily: 'var(--font-dota)',
            }}
          >
            {query.isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </Panel>
  )
}

// OpenDota's /teams has no season concept and its wins/losses/rating are
// lifetime totals, so a plain top-by-rating list surfaces teams that
// haven't played in years right alongside currently active ones. Limiting
// to teams with a recent match keeps the list to this season's actual
// contenders (the shown W/L and rating are still career totals, OpenDota
// doesn't expose season-scoped aggregates).
const ACTIVE_WINDOW_DAYS = 90

function TopTeams() {
  const teams = useQuery({
    queryKey: ['teams_list'],
    queryFn: () => opendota.teamsList(),
    staleTime: 30 * 60 * 1000,
  })
  const cutoff = Date.now() / 1000 - ACTIVE_WINDOW_DAYS * 86400
  const top = (teams.data ?? [])
    .filter((t) => t.name && t.last_match_time > cutoff)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 20)

  return (
    <Panel title="Top Teams This Season">
      {teams.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {top.map((t, i) => {
        const games = t.wins + t.losses
        const wr = games > 0 ? (t.wins / games) * 100 : 0
        return (
          <a
            key={t.team_id}
            href={`/team/${t.team_id}`}
            className="flex items-center gap-3 py-2 hover:bg-white/[0.03]"
            style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
          >
            <span className="w-5 text-right text-[13px] tabular-nums" style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}>
              {i + 1}
            </span>
            {t.logo_url ? (
              <img
                src={t.logo_url}
                alt=""
                className="h-7 w-7 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            ) : (
              <span className="h-7 w-7 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                {t.name}
              </div>
              <div className="text-[13px] tabular-nums" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                {t.wins}W · {t.losses}L
                <span className="ml-2" style={{ color: wr >= 55 ? '#8ec63f' : wr < 45 ? '#d14a38' : '#8a8474' }}>
                  {wr.toFixed(0)}%
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[15px] tabular-nums" style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}>
              {Math.round(t.rating)}
            </span>
          </a>
        )
      })}
    </Panel>
  )
}

function ProPlayers() {
  const players = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    staleTime: 60 * 60 * 1000,
  })
  const notable = useMemo(
    () => (players.data ?? []).filter((p) => p.is_pro && p.team_name),
    [players.data],
  )

  // Rank by live leaderboard position when we can (same source as the
  // /leaderboards page and the profile rank badge), not OpenDota's own
  // fame-ish default ordering: a top-5000 Immortal is more interesting
  // here than a pro who hasn't queued ranked in months.
  const ranks = useQuery({
    queryKey: ['pro_players_leaderboard_ranks', notable.map((p) => p.account_id)],
    queryFn: () =>
      findLeaderboardPositions(
        notable.map((p) => ({
          key: String(p.account_id),
          names: [p.personaname, p.name].filter((n): n is string => !!n),
        })),
      ),
    enabled: notable.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  const sorted = useMemo(() => {
    const rankMap = ranks.data
    return [...notable].sort((a, b) => {
      const ra = rankMap?.get(String(a.account_id))?.rank
      const rb = rankMap?.get(String(b.account_id))?.rank
      if (ra != null && rb != null) return ra - rb
      if (ra != null) return -1
      if (rb != null) return 1
      return 0
    })
  }, [notable, ranks.data])

  return (
    <Panel title="Pro Players">
      {players.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {sorted.slice(0, 20).map((p, i) => {
        const pos = ranks.data?.get(String(p.account_id))
        return (
          <a
            key={p.account_id}
            href={`/player/${p.account_id}`}
            className="flex items-center gap-3 py-2 hover:bg-white/[0.03]"
            style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
          >
            <img
              src={p.avatarmedium}
              alt={p.name ?? p.personaname ?? ''}
              className="h-7 w-7 shrink-0 rounded-full"
              style={{ border: '1px solid #2c2820' }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
                {p.name ?? p.personaname}
              </div>
              <div className="truncate text-[13px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>
                {p.team_name}
              </div>
            </div>
            {pos && (
              <span
                className="shrink-0 px-1.5 py-0.5 text-[12px] font-bold tabular-nums"
                style={{ background: '#2a2410', color: '#f2c94c' }}
                title={`Rank #${pos.rank} on Valve's leaderboard`}
              >
                #{pos.rank}
              </span>
            )}
            {p.loccountrycode && (
              <img
                src={countryFlagUrl(p.loccountrycode.toLowerCase())}
                alt={p.loccountrycode}
                className="shrink-0"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            )}
          </a>
        )
      })}
    </Panel>
  )
}

function ProPage() {
  usePageTitle('Pro Matches')

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ color: '#e8e2d4', fontFamily: 'var(--font-display)', letterSpacing: '2px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          Pro Scene
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em]"
          style={{ color: '#fff', fontFamily: 'var(--font-dota)', textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)' }}
        >
          Recent professional matches, team ratings, and players
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <ProMatches />
        </div>
        <TopTeams />
        <ProPlayers />
      </div>
    </div>
  )
}
