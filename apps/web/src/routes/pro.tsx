import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { SortHeader } from '@/components/ui/sort_header'
import { Spinner } from '@/components/ui/spinner'
import { countryFlagUrl, divisionLabel, divisionShort, findLeaderboardPositions } from '@/lib/leaderboard'
import { opendota } from '@/lib/opendota'
import { applySort, useSort } from '@/lib/sortable'
import { usePageTitle } from '@/lib/title'
import { tiChampionships } from '@/lib/ti_champions'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/pro')({
  component: ProPage,
})

/* Pro scene page: recent professional series results with winners and
   scores (filterable by league, load more), team ratings, and notable
   players. Data: OpenDota proMatches / teams / proPlayers. */

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 uppercase flex-wrap text-foreground font-display border-b border-border"
        style={{
          background: 'rgba(8,10,12,0.85)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
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
      className="truncate text-[14px] font-dota"
      style={{
        // #a09a8c is not in the Token Mapping Reference (close to but distinct
        // from #8a8474/#5a5648 text-muted) — left as-is per task instructions.
        color: won ? 'var(--color-radiant)' : '#a09a8c',
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
          aria-label="Search league name"
          className="px-2 py-1 text-[13px] normal-case focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold border border-border text-foreground font-dota"
          style={{
            background: 'rgba(8,10,12,0.7)',
            letterSpacing: 'normal',
            width: 170,
            maxWidth: '100%',
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
              className={`flex items-center gap-3 py-2.5 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamName name={m.radiant_name ?? 'Radiant'} won={radWon} />
                  <span
                    className="shrink-0 px-1.5 text-[14px] tabular-nums text-foreground font-dota"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    {m.radiant_score ?? '?'} : {m.dire_score ?? '?'}
                  </span>
                  <TeamName name={m.dire_name ?? 'Dire'} won={!radWon} />
                </div>
                {m.league_name && (
                  // #77715f is not in the Token Mapping Reference (close to but distinct
                  // from #8a8474/#5a5648 text-muted) — left as-is per task instructions.
                  <div className="mt-0.5 truncate text-[13px] font-dota" style={{ color: '#77715f' }}>
                    {m.league_name}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] tabular-nums text-muted font-dota">
                  {formatTimeAgo(m.start_time)}
                </div>
                <div className="mt-0.5 text-[13px] tabular-nums text-muted font-dota">
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
            className="min-h-11 px-5 py-1.5 text-[13px] uppercase cursor-pointer hover:brightness-125 disabled:opacity-50 border border-slate-card text-slate-foreground font-dota"
            style={{
              // #1a2024 is not in the Token Mapping Reference (close to but distinct
              // from #14181b bg-slate-bg) — left as-is per task instructions.
              background: '#1a2024',
              letterSpacing: '1px',
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

type TeamSortKey = 'wins' | 'losses' | 'winrate' | 'rating' | 'name'

function TopTeams() {
  const teams = useQuery({
    queryKey: ['teams_list'],
    queryFn: () => opendota.teamsList(),
    staleTime: 30 * 60 * 1000,
  })
  const { key: sortKey, dir: sortDir, onSort } = useSort<TeamSortKey>('rating', 'desc')
  const cutoff = Date.now() / 1000 - ACTIVE_WINDOW_DAYS * 86400
  const active = (teams.data ?? []).filter((t) => t.name && t.last_match_time > cutoff)
  const top = applySort(active, sortDir, (a, b) => {
    switch (sortKey) {
      case 'wins':
        return a.wins - b.wins
      case 'losses':
        return a.losses - b.losses
      case 'winrate': {
        const aGames = a.wins + a.losses
        const bGames = b.wins + b.losses
        const aWr = aGames > 0 ? a.wins / aGames : 0
        const bWr = bGames > 0 ? b.wins / bGames : 0
        return aWr - bWr
      }
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '')
      default:
        return a.rating - b.rating
    }
  }).slice(0, 20)

  return (
    <Panel title="Top Teams This Season">
      {teams.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {top.length > 0 && (
        <div
          className="flex items-center gap-3 py-2 text-[12px] uppercase text-muted font-dota border-b border-border"
          style={{ letterSpacing: '1px' }}
        >
          <span className="w-5 shrink-0" />
          <span className="h-7 w-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <SortHeader label="Team" sortKey="name" active={sortKey === 'name'} dir={sortDir} onClick={onSort} />
          </div>
          <SortHeader label="W" sortKey="wins" active={sortKey === 'wins'} dir={sortDir} onClick={onSort} className="w-10 shrink-0 justify-end" />
          <SortHeader label="L" sortKey="losses" active={sortKey === 'losses'} dir={sortDir} onClick={onSort} className="w-10 shrink-0 justify-end" />
          <SortHeader label="Win%" sortKey="winrate" active={sortKey === 'winrate'} dir={sortDir} onClick={onSort} className="w-14 shrink-0 justify-end" />
          <SortHeader
            label="Rating"
            sortKey="rating"
            active={sortKey === 'rating'}
            dir={sortDir}
            onClick={onSort}
            className="w-16 shrink-0 justify-end"
          />
        </div>
      )}
      {top.map((t, i) => {
        const games = t.wins + t.losses
        const wr = games > 0 ? (t.wins / games) * 100 : 0
        return (
          <a
            key={t.team_id}
            href={`/team/${t.team_id}`}
            className={`flex items-center gap-3 py-2 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
          >
            <span className="w-5 text-right text-[13px] tabular-nums text-muted font-dota">
              {i + 1}
            </span>
            {t.logo_url ? (
              <img
                src={t.logo_url}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                className="h-7 w-7 shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            ) : (
              <span className="h-7 w-7 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[14px] text-foreground font-dota">
                  {t.name}
                </span>
                {tiChampionships(t.team_id).length > 0 && (
                  <span
                    className="shrink-0 px-1.5 py-0.5 text-[11px] font-bold uppercase text-gold"
                    style={{ background: 'transparent', border: '1px solid rgba(242,201,76,0.5)', letterSpacing: '0.5px' }}
                    title={`The International Champion: ${tiChampionships(t.team_id)
                      .map((c) => (c.wonAs ? `TI${c.year} as ${c.wonAs}` : `TI${c.year}`))
                      .join(', ')}`}
                  >
                    TI {tiChampionships(t.team_id).map((c) => c.year).join('/')}
                  </span>
                )}
              </div>
              <div className="text-[13px] tabular-nums text-muted font-dota">
                {t.wins}W · {t.losses}L
                <span
                  className="ml-2"
                  style={{ color: wr >= 55 ? 'var(--color-radiant)' : wr < 45 ? 'var(--color-dire)' : 'var(--color-muted)' }}
                >
                  {wr.toFixed(0)}%
                </span>
                {t.last_match_time && (
                  <span className="ml-2 text-muted">
                    · Last played {formatTimeAgo(t.last_match_time)}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[15px] tabular-nums text-gold font-dota">
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

  // Only a fraction of the ~470 notable pros are still actively queuing
  // ranked, so sorting the whole list by rank alone crowded a fixed top-20
  // out entirely with leaderboard hits and hid every other notable player.
  // Reserve slots for both: ranked pros first (by rank), then fill the rest
  // with everyone else in OpenDota's own order.
  const { ranked, unranked } = useMemo(() => {
    const rankMap = ranks.data
    const withRank: typeof notable = []
    const without: typeof notable = []
    for (const p of notable) (rankMap?.has(String(p.account_id)) ? withRank : without).push(p)
    withRank.sort((a, b) => (rankMap?.get(String(a.account_id))?.rank ?? 0) - (rankMap?.get(String(b.account_id))?.rank ?? 0))
    return { ranked: withRank, unranked: without }
  }, [notable, ranks.data])

  const RANKED_SLOTS = 12
  const TOTAL_SLOTS = 20
  const shown = [...ranked.slice(0, RANKED_SLOTS), ...unranked.slice(0, TOTAL_SLOTS - Math.min(ranked.length, RANKED_SLOTS))]

  return (
    <Panel title="Pro Players">
      {players.isPending && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {shown.map((p, i) => {
        const pos = ranks.data?.get(String(p.account_id))
        return (
          <a
            key={p.account_id}
            href={`/player/${p.account_id}`}
            className={`flex items-center gap-3 py-2 hover:bg-white/[0.03] ${i === 0 ? '' : 'border-t border-border'}`}
          >
            <img
              src={p.avatarmedium}
              alt={p.name ?? p.personaname ?? ''}
              width={28}
              height={28}
              loading="lazy"
              className="h-7 w-7 shrink-0 rounded-full"
              // #2c2820 is not in the Token Mapping Reference (close to but distinct
              // from #2a2620/#24222a border-border) — left as-is per task instructions.
              style={{ border: '1px solid #2c2820' }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] text-foreground font-dota">
                {p.name ?? p.personaname}
              </div>
              <div className="truncate text-[13px] text-muted font-dota">
                {p.team_name}
              </div>
            </div>
            {pos && (
              <span
                className="shrink-0 px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-gold"
                style={{ background: 'transparent', border: '1px solid rgba(242,201,76,0.5)' }}
                title={`Rank #${pos.rank} on Valve's ${divisionLabel(pos.division)} leaderboard`}
              >
                #{pos.rank} {divisionShort(pos.division)}
              </span>
            )}
            {p.loccountrycode && (
              <img
                src={countryFlagUrl(p.loccountrycode.toLowerCase())}
                alt={p.loccountrycode}
                width={16}
                height={11}
                loading="lazy"
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
          className="text-[44px] leading-none font-bold uppercase text-foreground font-display"
          style={{ letterSpacing: '2px' }}
        >
          Pro Scene
        </h1>
        <p className="mt-2 text-[13px] uppercase tracking-[0.2em] text-foreground font-dota">
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
