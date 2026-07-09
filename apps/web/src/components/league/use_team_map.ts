import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { opendota } from '@/lib/opendota'

export type TeamInfo = { name: string | null; tag: string | null; logo_url: string | null }

// Firing all missing-team lookups at once (a 24+ team league standings
// page, say) is exactly the kind of burst that trips OpenDota's rate
// limiter; a handful come back 429 even with the retry in opendota.ts's
// get(). Cap how many are in flight at once instead of one big Promise.all.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// The bulk /teams endpoint only returns OpenDota's top ~1000 teams by
// rating, so older, smaller, or regional teams (a 2013 qualifier bracket,
// say) fall back to "Team <id>" even though OpenDota does have their name,
// just not in that bulk list. Backfill whichever ids this page actually
// needs via the per-team endpoint instead, same fallback pattern already
// used for missing player names in RosterPanel. Capped so a bracket full of
// obscure teams can't fire hundreds of individual requests at once, anyone
// past the cap keeps the "Team <id>" fallback.
export function useTeamMap(relevantTeamIds: (number | null | undefined)[]): Map<number, TeamInfo> {
  const teams = useQuery({
    queryKey: ['teams_list'],
    queryFn: () => opendota.teamsList(),
    staleTime: 30 * 60 * 1000,
  })
  const baseMap = useMemo(() => new Map<number, TeamInfo>((teams.data ?? []).map((t) => [t.team_id, t])), [teams.data])

  const missingIds = useMemo(() => {
    const ids = new Set<number>()
    for (const id of relevantTeamIds) {
      if (id != null && !baseMap.has(id)) ids.add(id)
    }
    return [...ids].slice(0, 80)
  }, [relevantTeamIds, baseMap])

  const fallback = useQuery({
    queryKey: ['team_fallback_info', missingIds],
    queryFn: async () => {
      const entries = await mapWithConcurrency(
        missingIds,
        5,
        async (id): Promise<[number, TeamInfo | null]> => {
          try {
            const t = await opendota.team(id)
            return [id, { name: t.name ?? null, tag: t.tag ?? null, logo_url: t.logo_url ?? null }]
          } catch {
            return [id, null]
          }
        },
      )
      return new Map(entries.filter((e): e is [number, TeamInfo] => e[1] != null))
    },
    enabled: missingIds.length > 0,
    staleTime: 60 * 60 * 1000,
  })

  return useMemo(() => {
    if (!fallback.data || fallback.data.size === 0) return baseMap
    const merged = new Map(baseMap)
    for (const [id, info] of fallback.data) merged.set(id, info)
    return merged
  }, [baseMap, fallback.data])
}
