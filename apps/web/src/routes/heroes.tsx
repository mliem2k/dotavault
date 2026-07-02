import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { HeroTable } from '@/components/heroes/hero-table'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'

export const Route = createFileRoute('/heroes')({
  component: HeroesPage,
})

function HeroesPage() {
  const heroes = useQuery({
    queryKey: ['heroes'],
    queryFn: () => opendota.heroStats(),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Hero Meta</h1>
      {heroes.isPending && <Spinner />}
      {heroes.data && <HeroTable heroes={heroes.data} />}
    </div>
  )
}
