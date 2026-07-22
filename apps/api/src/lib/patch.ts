import type { PatchConstant, ProMetaPatch } from 'types'
import { fetchCached } from './opendota'

// The array index doubles as the patch ID that Match.patch references, so
// the "current" patch is the last entry whose date has passed.
export function currentPatchFromList(
  patches: PatchConstant[],
  now: number = Date.now(),
): ProMetaPatch {
  let bestIndex = 0
  for (let i = 0; i < patches.length; i++) {
    if (new Date(patches[i].date).getTime() <= now) bestIndex = i
  }
  const patch = patches[bestIndex]
  return { id: bestIndex, name: patch.name, releasedAt: patch.date }
}

type FetchFn = (path: string, ttlSeconds: number) => Promise<unknown>

export async function resolveCurrentPatch(fetchFn: FetchFn = fetchCached): Promise<ProMetaPatch> {
  const patches = (await fetchFn('/constants/patch', 60 * 60 * 24)) as PatchConstant[]
  return currentPatchFromList(patches)
}
