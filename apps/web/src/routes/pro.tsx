import { useQuery } from '@tanstack/react-query'
import { usePageTitle } from '@/lib/title'
import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatDuration, formatTimeAgo } from '@/lib/utils'

export const Route = createFileRoute('/pro')({
  component: ProPage,
})

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase"
        style={{
          color: '#c8c2b4',
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '3px',
          borderBottom: '1px solid #24222a',
        }}
      >
        {title}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function ProPage() {
  usePageTitle('Pro Matches')
  const matches = useQuery({
    queryKey: ['pro-matches'],
    queryFn: () => opendota.proMatches(),
  })

  const players = useQuery({
    queryKey: ['pro-players'],
    queryFn: () => opendota.proPlayers(),
  })

  return (
    <div className="space-y-6 py-4">
      <div className="text-center mb-6">
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '2px' }}
        >
          Pro Scene
        </h1>
        <p
          className="mt-2 text-[13px] uppercase tracking-[0.2em]"
          style={{
            color: '#fff',
            fontFamily: 'var(--font-dota)',
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)',
          }}
        >
          Recent professional matches and players
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Recent Pro Matches">
          {matches.isPending && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {matches.data && (
            <div>
              {matches.data.slice(0, 20).map((m, i) => (
                <a
                  key={m.match_id}
                  href={`/match/${m.match_id}`}
                  className="flex items-start justify-between gap-4 py-2.5 hover:bg-white/[0.03]"
                  style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                >
                  <div className="min-w-0">
                    <div
                      className="text-[17px] truncate"
                      style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                    >
                      {m.radiant_name ?? 'Radiant'} vs {m.dire_name ?? 'Dire'}
                    </div>
                    {m.league_name && (
                      <div
                        className="text-[14px] mt-0.5 truncate"
                        style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}
                      >
                        {m.league_name}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-[15px] tabular-nums"
                      style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                    >
                      {formatTimeAgo(m.start_time)}
                    </div>
                    <div
                      className="text-[14px] tabular-nums mt-0.5"
                      style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
                    >
                      {formatDuration(m.duration)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pro Players">
          {players.isPending && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {players.data && (
            <div>
              {players.data
                .filter((p) => p.is_pro && p.team_name)
                .slice(0, 20)
                .map((p, i) => (
                  <a
                    key={p.account_id}
                    href={`/player/${p.account_id}`}
                    className="flex items-center gap-3 py-2 hover:bg-white/[0.03]"
                    style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                  >
                    <img
                      src={p.avatarmedium}
                      alt={p.name ?? p.personaname ?? ''}
                      className="h-7 w-7 rounded-full shrink-0"
                      style={{ border: '1px solid #2c2820' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[17px] truncate"
                        style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                      >
                        {p.name ?? p.personaname}
                      </div>
                      <div
                        className="text-[14px] truncate"
                        style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                      >
                        {p.team_name}
                      </div>
                    </div>
                    {p.loccountrycode && (
                      <span
                        className="text-[14px] tabular-nums shrink-0"
                        style={{ color: '#4a4436', fontFamily: 'var(--font-dota)' }}
                      >
                        {p.loccountrycode}
                      </span>
                    )}
                  </a>
                ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
