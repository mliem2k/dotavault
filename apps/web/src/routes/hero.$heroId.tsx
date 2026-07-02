import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { heroBracketTotal, winRate } from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroId')({
  component: HeroDetailPage,
})

function heroIconUrl(name: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${name.replace('npc_dota_hero_', '')}.png`
}

function HeroDetailPage() {
  const { heroId } = Route.useParams()

  const heroStats = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const hero = heroStats.data?.find((h) => String(h.id) === heroId)
  if (!hero) return <div className="text-sm text-muted">Hero not found.</div>

  const picks = heroBracketTotal(hero, 'pick')
  const wins = heroBracketTotal(hero, 'win')

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <img
          src={heroIconUrl(hero.name)}
          alt={hero.localized_name}
          className="h-24 rounded-lg"
        />
        <div>
          <h1 className="text-2xl font-semibold">{hero.localized_name}</h1>
          <div className="mt-1 text-sm text-muted">{hero.roles.join(' · ')}</div>
          <div className="mt-3 flex gap-6 text-sm">
            <div>
              <div className="font-mono text-lg">{winRate(wins, picks)}</div>
              <div className="text-xs text-muted">Win Rate</div>
            </div>
            <div>
              <div className="font-mono text-lg">{picks.toLocaleString()}</div>
              <div className="text-xs text-muted">Picks</div>
            </div>
            <div>
              <div className="font-mono text-lg">{hero.pro_ban}</div>
              <div className="text-xs text-muted">Pro Bans</div>
            </div>
            <div>
              <div className="font-mono text-lg">{winRate(hero.pro_win, hero.pro_pick)}</div>
              <div className="text-xs text-muted">Pro Win%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
