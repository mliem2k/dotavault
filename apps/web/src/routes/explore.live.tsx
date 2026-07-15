import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { usePageTitle } from '@/lib/title'

export const Route = createFileRoute('/explore/live')({
  component: LivePage,
})

function formatGameTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${sign}${m}:${s.toString().padStart(2, '0')}`
}

function LivePage() {
  usePageTitle('Explore · Live')
  const query = useQuery({
    queryKey: ['live_games'],
    queryFn: () => opendota.liveGames(),
    refetchInterval: 45_000,
  })

  const games = [...(query.data ?? [])].sort((a, b) => b.average_mmr - a.average_mmr)

  return (
    <div className="max-w-[1040px] mx-auto">
      <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
        <div
          className="px-4 py-3 uppercase text-foreground font-display border-b border-border"
          style={{ fontSize: 20, fontWeight: 500, letterSpacing: '3px' }}
        >
          Live Matches
        </div>
        <div className="px-4 py-3">
          {query.isPending ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : games.length === 0 ? (
            <div className="py-8 text-center text-[14px] text-muted">
              No live high-MMR matches right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-dota">
                <thead>
                  <tr className="text-[12px] font-bold uppercase tracking-widest text-muted">
                    <th className="pb-2 px-2 text-left">Match</th>
                    <th className="pb-2 px-2 text-right">Avg MMR</th>
                    <th className="pb-2 px-2 text-right">Game Time</th>
                    <th className="pb-2 px-2 text-right">Score</th>
                    <th className="pb-2 px-2 text-right">Spectators</th>
                    <th className="pb-2 px-2 text-right">Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.match_id} className="hover:bg-white/[0.03] border-t border-border">
                      <td className="px-2 py-1.5 text-[13px] text-foreground">
                        {g.team_name_radiant && g.team_name_dire
                          ? `${g.team_name_radiant} vs ${g.team_name_dire}`
                          : `Match ${g.match_id}`}
                      </td>
                      <td className="px-2 text-right text-[13px] tabular-nums text-gold">
                        {g.average_mmr.toLocaleString()}
                      </td>
                      <td className="px-2 text-right text-[13px] tabular-nums text-muted">
                        {formatGameTime(g.game_time)}
                      </td>
                      <td className="px-2 text-right text-[13px] tabular-nums text-foreground">
                        {g.radiant_score}-{g.dire_score}
                      </td>
                      <td className="px-2 text-right text-[13px] tabular-nums text-muted">
                        {g.spectators.toLocaleString()}
                      </td>
                      <td className="px-2 text-right text-[13px] tabular-nums text-muted">
                        {g.delay}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
