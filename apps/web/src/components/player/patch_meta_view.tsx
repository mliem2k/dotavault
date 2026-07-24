import { BanSuggestionsTable } from '@/components/player/ban_suggestions_table'
import { TopHeroesThisPatchTable } from '@/components/player/top_heroes_this_patch_table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { usePlayerData } from '@/lib/player_data_context'

const C = { white: 'var(--color-white)', panel: 'rgba(16,19,22,0.72)' }

export function PatchMetaView() {
  const { currentPatch, playerHeroesThisPatch, heroStats } = usePlayerData()

  if (currentPatch.isError || playerHeroesThisPatch.isError) {
    return (
      <div className="text-sm text-muted py-10 text-center">
        Couldn't load this patch's hero data right now.{' '}
        <button
          type="button"
          onClick={() => {
            currentPatch.refetch()
            playerHeroesThisPatch.refetch()
          }}
          className="underline text-gold cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  if (currentPatch.isPending || playerHeroesThisPatch.isPending || heroStats.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }

  const patch = currentPatch.data
  const heroes = playerHeroesThisPatch.data
  if (!patch || !heroes || !heroStats.data) return null

  const totalGames = heroes.reduce((sum, h) => sum + h.games, 0)
  if (totalGames === 0) {
    return (
      <div className="py-10 text-center text-muted">
        No games recorded yet for patch {patch.name}.
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3 font-dota">
        <Badge variant="pro">Patch {patch.name}</Badge>
      </div>

      <div className="max-w-[720px] mx-auto" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: 'rgba(8,10,12,0.7)' }}
        >
          Top Heroes This Patch
        </div>
        <div className="p-4">
          <TopHeroesThisPatchTable playerHeroes={heroes} heroStats={heroStats.data} />
        </div>
      </div>

      <div className="max-w-[720px] mx-auto" style={{ background: C.panel }}>
        <div
          className="text-[15px] uppercase px-4 py-3"
          style={{ color: C.white, letterSpacing: '2px', background: 'rgba(8,10,12,0.7)' }}
        >
          Ban Suggestions This Patch
        </div>
        <div className="p-4">
          <BanSuggestionsTable playerHeroes={heroes} heroStats={heroStats.data} />
        </div>
      </div>
    </div>
  )
}
