import type { PatchConstant, ProMetaPatch } from 'types'

// The array index doubles as the patch ID that Match.patch references, so
// the "current" patch is the last entry whose date has passed. Mirrors
// apps/api/src/lib/patch.ts's function of the same name exactly - keep
// both in sync if this algorithm ever changes.
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
