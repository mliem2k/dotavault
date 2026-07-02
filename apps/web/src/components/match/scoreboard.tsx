import type { HeroStat, MatchPlayer } from 'types'

function PlayerRow({ player, hero }: { player: MatchPlayer; hero: HeroStat | undefined }) {
  return (
    <tr className="border-b border-border/50 text-sm">
      <td className="py-1.5">
        <a
          href={player.account_id ? `/player/${player.account_id}` : '#'}
          className="flex items-center gap-2 hover:text-accent"
        >
          {hero && (
            <img
              src={`https://cdn.opendota.com${hero.icon}`}
              alt={hero.localized_name}
              className="h-6 w-6 rounded"
            />
          )}
          <span className="text-foreground">{player.personaname ?? player.name ?? 'Unknown'}</span>
        </a>
      </td>
      <td className="py-1.5 text-right font-mono text-muted">{player.kills}</td>
      <td className="py-1.5 text-right font-mono text-muted">{player.deaths}</td>
      <td className="py-1.5 text-right font-mono text-muted">{player.assists}</td>
      <td className="py-1.5 text-right font-mono text-muted">
        {player.net_worth?.toLocaleString() ?? '—'}
      </td>
      <td className="py-1.5 text-right font-mono text-muted">{player.gold_per_min}</td>
      <td className="py-1.5 text-right font-mono text-muted">{player.xp_per_min}</td>
    </tr>
  )
}

const tableHeaders = (
  <tr className="text-left text-xs text-muted">
    <th className="pb-2 font-normal">Player</th>
    <th className="pb-2 font-normal text-right">K</th>
    <th className="pb-2 font-normal text-right">D</th>
    <th className="pb-2 font-normal text-right">A</th>
    <th className="pb-2 font-normal text-right">Net Worth</th>
    <th className="pb-2 font-normal text-right">GPM</th>
    <th className="pb-2 font-normal text-right">XPM</th>
  </tr>
)

export function Scoreboard({
  players,
  heroStats,
  radiantWin,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
  radiantWin: boolean
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = players.filter((p) => p.player_slot < 128)
  const dire = players.filter((p) => p.player_slot >= 128)

  return (
    <div className="space-y-4">
      <div>
        <div className={`mb-2 text-xs font-medium ${radiantWin ? 'text-radiant' : 'text-muted'}`}>
          Radiant {radiantWin ? '(Winner)' : ''}
        </div>
        <table className="w-full">
          <thead>{tableHeaders}</thead>
          <tbody>
            {radiant.map((p) => (
              <PlayerRow key={p.player_slot} player={p} hero={heroMap.get(p.hero_id)} />
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className={`mb-2 text-xs font-medium ${!radiantWin ? 'text-dire' : 'text-muted'}`}>
          Dire {!radiantWin ? '(Winner)' : ''}
        </div>
        <table className="w-full">
          <thead>{tableHeaders}</thead>
          <tbody>
            {dire.map((p) => (
              <PlayerRow key={p.player_slot} player={p} hero={heroMap.get(p.hero_id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
