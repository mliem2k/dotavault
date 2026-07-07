import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { usePageTitle } from '@/lib/title'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SearchBar } from '@/components/search/search_bar'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { formatTimeAgo, heroBracketTotal, heroIconFromPath, heroSlug, winRate } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// Dota2.com-style panel: translucent dark over the greyfade texture, Reaver uppercase header.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase text-center"
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

function HomePage() {
  usePageTitle(null)
  const heroes = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  const proMatches = useQuery({
    queryKey: ['pro-matches'],
    queryFn: () => opendota.proMatches(),
  })

  const topHeroes = useMemo(() => {
    if (!heroes.data) return []
    return [...heroes.data]
      .sort((a, b) => {
        const ap = heroBracketTotal(a, 'pick')
        const aw = heroBracketTotal(a, 'win')
        const bp = heroBracketTotal(b, 'pick')
        const bw = heroBracketTotal(b, 'win')
        return bw / (bp || 1) - aw / (ap || 1)
      })
      .slice(0, 8)
  }, [heroes.data])

  return (
    <div className="space-y-12">
      <div className="flex flex-col items-center gap-8 py-24 text-center">
        <h1
          className="font-display font-bold uppercase text-foreground break-words"
          style={{
            fontSize: 'clamp(2rem, 8vw, 4.5rem)',
            lineHeight: 1.1,
            letterSpacing: '0.02em',
            textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.7)',
          }}
        >
          dotavault
        </h1>
        <div className="h-px w-20 bg-[#24222a]" />
        <p
          className="text-base uppercase text-white"
          style={{ letterSpacing: '0.15em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          Dota 2 stats, match analysis, and replay viewer
        </p>
        <SearchBar />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-4xl mx-auto w-full">
        <Panel title="Recent Pro Matches">
          {proMatches.isPending && <Spinner />}
          {proMatches.data && (
            <div>
              {proMatches.data.slice(0, 8).map((m, i) => (
                <Link
                  key={m.match_id}
                  to="/match/$matchId"
                  params={{ matchId: String(m.match_id) }}
                  className="flex items-center justify-between py-2.5 hover:bg-white/[0.03]"
                  style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                >
                  <span
                    className="text-[17px]"
                    style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                  >
                    {m.radiant_name ?? 'Radiant'} vs {m.dire_name ?? 'Dire'}
                  </span>
                  <span
                    className="text-[14px] tabular-nums"
                    style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                  >
                    {formatTimeAgo(m.start_time)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Heroes (This Week)">
          {heroes.isPending && <Spinner />}
          {heroes.data && (
            <div>
              {topHeroes.map((h, i) => {
                const picks = heroBracketTotal(h, 'pick')
                const wins = heroBracketTotal(h, 'win')
                const wr = picks > 0 ? (wins / picks) * 100 : 0
                return (
                  <Link
                    key={h.id}
                    to="/hero/$heroName"
                    params={{ heroName: heroSlug(h.localized_name) }}
                    className="flex items-center justify-between py-2 hover:bg-white/[0.03]"
                    style={{ borderTop: i === 0 ? undefined : '1px solid #1c1810' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={heroIconFromPath(h.icon)}
                        alt={h.localized_name}
                        loading="lazy"
                        className="h-7 w-7 rounded"
                      />
                      <span
                        className="text-[17px]"
                        style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                      >
                        {h.localized_name}
                      </span>
                    </div>
                    <span
                      className="text-[14px] font-semibold tabular-nums"
                      style={{
                        color: wr >= 50 ? '#8ec63f' : '#d14a38',
                        fontFamily: 'var(--font-dota)',
                      }}
                    >
                      {winRate(wins, picks)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
