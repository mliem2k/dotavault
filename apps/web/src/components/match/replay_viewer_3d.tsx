import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CreepInstance, HeroStat, Match, PositionPoint } from 'types'
import { BUILDINGS, MAP_MAX, MAP_MIN } from '@/lib/buildings'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { CANVAS_COLOR, sampleAt, type WardLife } from './replay_viewer'
import {
  buildInstance,
  CREEP_MODEL_URL,
  createGltfLoader,
  disposeModelInstance,
  fitHeight,
  HERO_MODEL_URL,
  heroArchetype,
  type ModelInstance,
  setAction,
} from './replay_viewer_3d_models'

/* Spectator 3D view: flat textured ground, free-look camera, animated
   character models for heroes/creeps, box/cone markers for buildings. */

// Scene units are arbitrary, the ground plane just needs to span this size
// so building/hero/creep positions line up with it.
const WORLD_SIZE = 100
const NEUTRAL_COLOR = '#8a7fa8'
const ROSHAN_COLOR = '#ff7a1a'
const TORMENTOR_COLOR = '#8a5cff'
// A creep with no sample in the last few seconds has despawned, there's no
// explicit end-of-life marker (see CreepInstance's doc comment).
const CREEP_STALE_AFTER = 3

const HERO_TARGET_HEIGHT = 2.6 // matches the old cone's height, keeps hero-to-building scale unchanged
const HERO_DECAL_SIZE = 1
// Idle/Walk/Run split: samples are 1Hz, so comparing a sample to the one
// before it is a cheap, scrub-safe stand-in for "is this hero moving".
const IDLE_DIST_EPS = 0.05 // world-grid units between consecutive samples
const IDLE_SPEED_EPS = 5 // dota move-speed stat, never legitimately this low while actually moving
const RUN_SPEED_THRESHOLD = 320 // arbitrary Walk/Run split, cosmetic only

function toScene(x: number, y: number): { x: number; z: number } {
  const nx = (x - MAP_MIN) / (MAP_MAX - MAP_MIN)
  const ny = (y - MAP_MIN) / (MAP_MAX - MAP_MIN)
  // The 2D canvas flips world-y (size - toCanvas(y, size)) because canvas-y
  // grows downward; the ground plane's default UVs already put high
  // world-y at the texture's top edge once rotated flat, so mirroring that
  // same flip onto the Z axis here keeps markers lined up with the texture
  // instead of mirrored or upside down.
  return { x: (nx - 0.5) * WORLD_SIZE, z: (0.5 - ny) * WORLD_SIZE }
}

function creepStyle(kind: CreepInstance['kind'], team: number) {
  const size =
    kind === 'roshan' || kind === 'tormentor'
      ? 2.4
      : kind === 'siege'
        ? 1.2
        : kind === 'neutral'
          ? 0.9
          : 0.7
  const color =
    kind === 'roshan'
      ? ROSHAN_COLOR
      : kind === 'tormentor'
        ? TORMENTOR_COLOR
        : kind === 'neutral'
          ? NEUTRAL_COLOR
          : team === 2
            ? CANVAS_COLOR.green
            : CANVAS_COLOR.red
  return { size, color }
}

// Human model gives neutral camp creeps a distinct silhouette from the
// orc lane/siege waves (and from Roshan/Tormentor, also orc-based but much
// bigger and darker-tinted); there's no dedicated boss model available.
function creepModelUrl(kind: CreepInstance['kind']): string {
  return kind === 'neutral' ? CREEP_MODEL_URL.human : CREEP_MODEL_URL.orc
}

type HeroEntry = {
  sprite: THREE.Sprite
  decal: THREE.Mesh
  model?: ModelInstance
}

type CreepEntry = {
  decal: THREE.Mesh
  model?: ModelInstance
}

export function Replay3DView({
  match,
  heroMap,
  denseBySlot,
  wardLives,
  buildingDeaths,
  time,
  className,
}: {
  match: Match
  heroMap: Map<number, HeroStat>
  denseBySlot: Map<number, PositionPoint[]>
  wardLives: WardLife[]
  buildingDeaths: number[]
  time: number
  // Overrides the default square, 560px-capped sizing, e.g. for a fullscreen
  // container. Non-square is fine here (unlike the 2D canvas): the
  // perspective camera's aspect ratio already tracks the container via the
  // existing ResizeObserver below.
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{ update: (t: number) => void } | null>(null)
  // Setup only needs the current time once, for the initial paint; keeping
  // it out of the setup effect's deps avoids tearing down the whole scene
  // every animation frame (same drawRef/timeRef pattern as replay_viewer.tsx).
  const timeRef = useRef(time)
  useEffect(() => {
    timeRef.current = time
  }, [time])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    // PCFSoftShadowMap is deprecated in this three.js version (silently
    // falls back to PCFShadowMap anyway), so request it directly.
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a1a0a)
    scene.fog = new THREE.Fog(0x0a1a0a, 60, 150)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(0, 70, 70)
    camera.lookAt(0, 0, 0)

    const w = container.clientWidth || 560
    const h = container.clientHeight || 560
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 20
    controls.maxDistance = 200
    controls.update()
    const render = () => renderer.render(scene, camera)
    controls.addEventListener('change', render)

    // Lighting: one angled key light for soft shadows, one sky/ground fill
    // light so unlit sides of characters don't go pure black.
    const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x1a1410, 0.9)
    scene.add(hemiLight)
    const dirLight = new THREE.DirectionalLight(0xfff2d9, 1.2)
    dirLight.position.set(40, 60, 30)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    dirLight.shadow.camera.left = -WORLD_SIZE / 2
    dirLight.shadow.camera.right = WORLD_SIZE / 2
    dirLight.shadow.camera.top = WORLD_SIZE / 2
    dirLight.shadow.camera.bottom = -WORLD_SIZE / 2
    dirLight.shadow.camera.far = 150
    scene.add(dirLight)

    // Ground: one flat plane, textured with the same minimap image the 2D
    // view uses, no elevation mesh. MeshStandardMaterial (not Basic) so the
    // lighting/shadows above actually show up on it.
    const groundGeom = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, roughness: 1 })
    const ground = new THREE.Mesh(groundGeom, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    new THREE.TextureLoader().load('/minimap.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      groundMat.map = tex
      // MeshStandardMaterial multiplies map by color, so the dark fallback
      // color set above (shown while the texture loads) would otherwise
      // tint the loaded minimap image almost entirely black forever.
      groundMat.color.set(0xffffff)
      groundMat.needsUpdate = true
      render()
    })

    // Buildings: box for tower/rax, cone for the fort, hidden once destroyed.
    const buildingMeshes = BUILDINGS.map((b) => {
      const { x, z } = toScene(b.x, b.y)
      const color = b.team === 'radiant' ? CANVAS_COLOR.green : CANVAS_COLOR.red
      const mesh =
        b.kind === 'fort'
          ? new THREE.Mesh(
              new THREE.ConeGeometry(2.4, 4.4, 8),
              new THREE.MeshBasicMaterial({ color }),
            )
          : new THREE.Mesh(
              new THREE.BoxGeometry(1.6, b.kind === 'tower' ? 3 : 2, 1.6),
              new THREE.MeshBasicMaterial({ color }),
            )
      mesh.position.set(x, mesh.geometry.parameters.height / 2, z)
      mesh.castShadow = true
      scene.add(mesh)
      return mesh
    })

    // Observer wards: fixed position, only visibility changes over time.
    const wardMeshes = wardLives.map((wLife) => {
      const { x, z } = toScene(wLife.x, wLife.y)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#f2c94c' }),
      )
      mesh.position.set(x, 0.9, z)
      mesh.visible = false
      scene.add(mesh)
      return mesh
    })

    // A ground-decal ring conveys team/kind color without tinting a
    // textured character mesh; one shared geometry, scaled per instance.
    const decalGeom = new THREE.RingGeometry(0.55, 0.85, 24)
    const decalMatCache = new Map<string, THREE.MeshBasicMaterial>()
    function decalMaterial(color: string) {
      let mat = decalMatCache.get(color)
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        })
        decalMatCache.set(color, mat)
      }
      return mat
    }
    function makeDecal(color: string, size: number) {
      const mesh = new THREE.Mesh(decalGeom, decalMaterial(color))
      mesh.rotation.x = -Math.PI / 2
      mesh.scale.setScalar(size)
      scene.add(mesh)
      return mesh
    }

    const gltfLoader = createGltfLoader()
    // Every clone's AnimationMixer lives here so update(t) can drive them
    // all from one game-time delta, see the lastT tracking below.
    const mixers: THREE.AnimationMixer[] = []

    // Heroes: an archetype character model plus a billboarded portrait
    // sprite above it (still useful since several heroes can share a model).
    const heroEntries = new Map<number, HeroEntry>()
    for (const player of match.players) {
      const isRadiant = player.player_slot < 128
      const color = isRadiant ? CANVAS_COLOR.green : CANVAS_COLOR.red

      const decal = makeDecal(color, HERO_DECAL_SIZE)
      decal.visible = false

      const spriteMat = new THREE.SpriteMaterial({ transparent: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(3, 3, 1)
      sprite.visible = false
      scene.add(sprite)

      const entry: HeroEntry = { sprite, decal }
      heroEntries.set(player.player_slot, entry)

      const hero = heroMap.get(player.hero_id)
      if (hero) {
        const loader = new THREE.TextureLoader()
        loader.load(
          heroIconUrl(hero.name),
          (tex) => {
            spriteMat.map = tex
            spriteMat.needsUpdate = true
            render()
          },
          undefined,
          () => {
            loader.load(heroIconFromPath(hero.icon), (tex) => {
              spriteMat.map = tex
              spriteMat.needsUpdate = true
              render()
            })
          },
        )
      }

      const archetype = heroArchetype(hero)
      gltfLoader.load(HERO_MODEL_URL[archetype]).then((gltf) => {
        if (disposed) return
        const inst = buildInstance(gltf, ['Idle', 'Walk', 'Run'])
        fitHeight(inst.root, HERO_TARGET_HEIGHT)
        inst.root.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true
            node.receiveShadow = true
          }
        })
        inst.root.visible = false
        scene.add(inst.root)
        mixers.push(inst.mixer)
        entry.model = inst
        update(timeRef.current)
      })
    }

    // Creeps: pooled by index into match.creeps, created lazily the first
    // time each one is seen active, then reused (hidden when not active).
    // A match can carry thousands of creep instances over its lifetime, so
    // meshes are only ever created for ones actually rendered at least once.
    const creepPool = new Map<number, CreepEntry>()

    let lastT = timeRef.current

    function update(t: number) {
      const dt = t - lastT
      lastT = t
      for (const mixer of mixers) mixer.update(dt)

      BUILDINGS.forEach((_, i) => {
        buildingMeshes[i].visible = t < buildingDeaths[i]
      })

      wardLives.forEach((wLife, i) => {
        wardMeshes[i].visible = t >= wLife.start && t <= wLife.end
      })

      for (const player of match.players) {
        const entry = heroEntries.get(player.player_slot)
        if (!entry) continue
        const points = denseBySlot.get(player.player_slot)
        const sample = sampleAt(points, t)
        const dead = sample == null || sample.hp === 0
        entry.sprite.visible = !dead
        entry.decal.visible = !dead
        if (entry.model) entry.model.root.visible = !dead
        if (!dead && sample) {
          const { x, z } = toScene(sample.x, sample.y)
          entry.sprite.position.set(x, 3.6, z)
          entry.decal.position.set(x, 0.03, z)
          if (entry.model) {
            entry.model.root.position.set(x, 0, z)
            const prev = sampleAt(points, sample.t - 0.5)
            const dist =
              prev && prev !== sample ? Math.hypot(sample.x - prev.x, sample.y - prev.y) : 0
            const moving = dist > IDLE_DIST_EPS && sample.speed > IDLE_SPEED_EPS
            const next = !moving
              ? entry.model.actions.Idle
              : sample.speed >= RUN_SPEED_THRESHOLD
                ? (entry.model.actions.Run ?? entry.model.actions.Walk)
                : (entry.model.actions.Walk ?? entry.model.actions.Run)
            setAction(entry.model, next)
          }
        }
      }

      const seen = new Set<number>()
      ;(match.creeps ?? []).forEach((creep, idx) => {
        const sample = sampleAt(creep.positions, t)
        if (!sample || sample.t > t || sample.hp <= 0 || t - sample.t > CREEP_STALE_AFTER) return
        seen.add(idx)
        let entry = creepPool.get(idx)
        if (!entry) {
          const { size, color } = creepStyle(creep.kind, creep.team)
          const created: CreepEntry = { decal: makeDecal(color, size) }
          entry = created
          creepPool.set(idx, created)
          gltfLoader.load(creepModelUrl(creep.kind)).then((gltf) => {
            if (disposed) return
            const inst = buildInstance(gltf, ['idle', 'walk'])
            fitHeight(inst.root, size)
            inst.root.traverse((node) => {
              if (node instanceof THREE.Mesh) node.castShadow = true
            })
            scene.add(inst.root)
            mixers.push(inst.mixer)
            created.model = inst
            update(timeRef.current)
          })
        }
        const { x, z } = toScene(sample.x, sample.y)
        entry.decal.visible = true
        entry.decal.position.set(x, 0.03, z)
        if (entry.model) {
          entry.model.root.visible = true
          entry.model.root.position.set(x, 0, z)
          const prev = sampleAt(creep.positions, sample.t - 0.5)
          const dist =
            prev && prev !== sample ? Math.hypot(sample.x - prev.x, sample.y - prev.y) : 0
          const moving = dist > IDLE_DIST_EPS
          setAction(
            entry.model,
            moving
              ? (entry.model.actions.walk ?? entry.model.actions.idle)
              : entry.model.actions.idle,
          )
        }
      })
      for (const [idx, entry] of creepPool) {
        if (seen.has(idx)) continue
        entry.decal.visible = false
        if (entry.model) entry.model.root.visible = false
      }

      render()
    }
    sceneRef.current = { update }
    update(timeRef.current)

    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (!box) return
      const nw = Math.max(1, Math.round(box.width))
      const nh = Math.max(1, Math.round(box.height))
      renderer.setSize(nw, nh, false)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      render()
    })
    ro.observe(container)

    return () => {
      disposed = true
      sceneRef.current = null
      ro.disconnect()
      controls.removeEventListener('change', render)
      controls.dispose()

      groundMat.map?.dispose()
      groundGeom.dispose()
      groundMat.dispose()
      for (const mesh of buildingMeshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const mesh of wardMeshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const entry of heroEntries.values()) {
        entry.sprite.material.map?.dispose()
        entry.sprite.material.dispose()
        if (entry.model) {
          entry.model.mixer.stopAllAction()
          disposeModelInstance(entry.model.root)
        }
      }
      for (const entry of creepPool.values()) {
        if (entry.model) {
          entry.model.mixer.stopAllAction()
          disposeModelInstance(entry.model.root)
        }
      }
      decalGeom.dispose()
      for (const mat of decalMatCache.values()) mat.dispose()
      dirLight.shadow.map?.dispose()
      // Fire-and-forget: nothing awaits component teardown, and any load
      // still in flight is left for the browser's own GC once it settles.
      void gltfLoader.disposeAll()

      renderer.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
    // Static per-match data (buildings/wards/heroes/creeps), only rebuilt if
    // the match itself (or its derived data) changes identity, not on every
    // playback tick, see the sceneRef/timeRef comment above.
  }, [match, heroMap, denseBySlot, wardLives, buildingDeaths])

  useEffect(() => {
    sceneRef.current?.update(time)
  }, [time])

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full max-w-[560px] aspect-square border border-slate-bg'}
    />
  )
}
