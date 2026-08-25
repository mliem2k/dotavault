import * as THREE from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import type { HeroStat } from 'types'

/* Archetype mapping, model loading/cloning and animation-instance plumbing
   shared by the hero and creep model code in replay_viewer_3d.tsx. Pure
   helpers only, no scene/effect lifecycle lives here. */

export type HeroArchetype = 'warrior' | 'ranger' | 'wizard' | 'cleric' | 'monk' | 'rogue'

export const HERO_MODEL_URL: Record<HeroArchetype, string> = {
  warrior: '/models/heroes/warrior.gltf',
  ranger: '/models/heroes/ranger.gltf',
  wizard: '/models/heroes/wizard.gltf',
  cleric: '/models/heroes/cleric.gltf',
  monk: '/models/heroes/monk.gltf',
  rogue: '/models/heroes/rogue.gltf',
}

export const CREEP_MODEL_URL = {
  orc: '/models/creeps/orc.glb',
  human: '/models/creeps/human.glb',
} as const

export const BUILDING_MODEL_URL = {
  tower: '/models/buildings/tower.glb',
  rax: '/models/buildings/barracks.glb',
  fort: '/models/buildings/ancient.glb',
} as const

// HeroStat.attack_type/primary_attr come straight from OpenDota's /heroStats
// response ('Melee'|'Ranged', 'str'|'agi'|'int'|'all'), confirmed against
// this repo's own comparisons in meta_view.tsx, lane_roles.ts and
// hero.$heroName.tsx (which lowercases attack_type only for an icon URL,
// implying the raw value is capitalized).
export function heroArchetype(hero: HeroStat | undefined): HeroArchetype {
  if (hero?.attack_type === 'Melee') {
    if (hero.primary_attr === 'str') return 'warrior'
    if (hero.primary_attr === 'agi') return 'rogue'
    if (hero.primary_attr === 'int') return 'monk'
    return 'warrior' // universal or unexpected attr on a melee hero
  }
  if (hero?.attack_type === 'Ranged') {
    if (hero.primary_attr === 'str') return 'cleric'
    if (hero.primary_attr === 'agi') return 'ranger'
    if (hero.primary_attr === 'int') return 'wizard'
    return 'wizard' // universal or unexpected attr on a ranged hero
  }
  return 'warrior' // attack_type missing or unexpected
}

export type ModelInstance = {
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  actions: Record<string, THREE.AnimationAction>
  current?: THREE.AnimationAction
}

// SkeletonUtils.clone gives each instance its own Skeleton/Bone graph so
// multiple simultaneous instances don't mirror one shared pose, but the
// clone's meshes still point at the original's geometry/material (see
// disposeGltf vs disposeModelInstance below), so this stays cheap per player.
export function buildInstance(gltf: GLTF, clipNames: string[]): ModelInstance {
  const root = skeletonClone(gltf.scene)
  const mixer = new THREE.AnimationMixer(root)
  const actions: Record<string, THREE.AnimationAction> = {}
  for (const name of clipNames) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name)
    if (clip) actions[name] = mixer.clipAction(clip)
  }
  return { root, mixer, actions }
}

// Normalizes an instance's height to targetHeight, whatever scale it was authored at.
export function fitHeight(root: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(root)
  const height = box.max.y - box.min.y
  if (height > 0.001) root.scale.multiplyScalar(targetHeight / height)
}

// Crossfades to the next action, a no-op if it's already playing or absent
// (missing clip name on this archetype).
export function setAction(
  state: { current?: THREE.AnimationAction },
  next: THREE.AnimationAction | undefined,
) {
  if (!next || state.current === next) return
  next.reset().fadeIn(0.2).play()
  state.current?.fadeOut(0.2)
  state.current = next
}

// Only the cloned Skeleton (and the GPU bone texture it may own) is unique
// to this instance; geometry/material belong to the cached GLTF, see disposeGltf.
export function disposeModelInstance(root: THREE.Object3D) {
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose()
  })
}

// Disposes the geometry/material/textures of an originally-loaded GLTF's
// scene graph. Call once per cached URL, only after every clone made from it
// is gone (this file only ever calls it from the same effect cleanup that
// also drops every clone, so that always holds).
export function disposeGltf(gltf: GLTF) {
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    node.geometry.dispose()
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose()
      }
      mat.dispose()
    }
  })
}

export function createGltfLoader() {
  const loader = new GLTFLoader()
  const cache = new Map<string, Promise<GLTF>>()
  return {
    load(url: string): Promise<GLTF> {
      let p = cache.get(url)
      if (!p) {
        p = loader.loadAsync(url)
        cache.set(url, p)
      }
      return p
    },
    // Best-effort: a load still in flight when the component unmounts is left
    // for the browser to garbage-collect, there's nothing to dispose yet.
    async disposeAll() {
      for (const p of cache.values()) {
        const gltf = await p.catch(() => null)
        if (gltf) disposeGltf(gltf)
      }
    },
  }
}
