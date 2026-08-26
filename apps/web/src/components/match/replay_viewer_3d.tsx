import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CreepInstance, HeroStat, Match, PositionPoint } from 'types'
import { BUILDINGS, MAP_MAX, MAP_MIN } from '@/lib/buildings'
import { RUNE_SPOTS } from '@/lib/runes'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { CANVAS_COLOR, sampleAt, type WardLife } from './replay_viewer'
import {
  BUILDING_MODEL_URL,
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
// Ground subdivision for terrain displacement, matches the heightmap's own
// grid resolution (see generate-terrain-heightmap.ts).
const GROUND_SEGMENTS = 64
const TERRAIN_HEIGHTMAP_URL = '/models/terrain_heightmap.json'
// Subtle relief, not a mountain range: a few percent of WORLD_SIZE.
const MAX_TERRAIN_HEIGHT = WORLD_SIZE * 0.04
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
    // Flatter, more zoomed-out oblique angle than a steep close-in view:
    // horizontal distance grows more than height (lower elevation angle),
    // and a narrower fov reads as a flatter, more compressed look.
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000)
    camera.position.set(0, 62, 128)
    camera.lookAt(0, 0, 0)

    const w = container.clientWidth || 560
    const h = container.clientHeight || 560
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()

    // Dota's own camera locks the viewing angle, only pan and zoom are
    // player-controllable, so rotate is disabled here too rather than left
    // as free-look orbiting.
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableRotate = false
    controls.minDistance = 20
    controls.maxDistance = 200
    controls.update()
    const render = () => renderer.render(scene, camera)
    controls.addEventListener('change', render)

    // Edge-pan camera, same idea as Dota's own default camera: moving the
    // cursor to a screen edge scrolls the view across the map (translating
    // camera + orbit target together, not rotating), independent of the
    // playback clock, so it needs its own rAF loop rather than piggybacking
    // on update(t) below.
    const EDGE_PAN_MARGIN = 36
    const EDGE_PAN_SPEED = 46 // world units/sec at full edge proximity
    const PAN_BOUND = WORLD_SIZE * 0.75 // a bit past the map edge, not infinite
    let pointerX = -1
    let pointerY = -1
    let pointerInside = false
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerX = e.clientX - rect.left
      pointerY = e.clientY - rect.top
      pointerInside = true
    }
    const onPointerLeave = () => {
      pointerInside = false
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)

    let lastPanT = performance.now()
    let panRaf = requestAnimationFrame(function panTick(now) {
      const dt = (now - lastPanT) / 1000
      lastPanT = now
      if (pointerInside) {
        const w = renderer.domElement.clientWidth || 1
        const h = renderer.domElement.clientHeight || 1
        const edgeFactor = (pos: number, extent: number) =>
          pos < EDGE_PAN_MARGIN
            ? -(1 - pos / EDGE_PAN_MARGIN)
            : pos > extent - EDGE_PAN_MARGIN
              ? 1 - (extent - pos) / EDGE_PAN_MARGIN
              : 0
        const panX = edgeFactor(pointerX, w)
        const panZ = edgeFactor(pointerY, h)
        if (panX !== 0 || panZ !== 0) {
          const dx = panX * EDGE_PAN_SPEED * dt
          const dz = panZ * EDGE_PAN_SPEED * dt
          const nx = THREE.MathUtils.clamp(controls.target.x + dx, -PAN_BOUND, PAN_BOUND)
          const nz = THREE.MathUtils.clamp(controls.target.z + dz, -PAN_BOUND, PAN_BOUND)
          camera.position.x += nx - controls.target.x
          camera.position.z += nz - controls.target.z
          controls.target.x = nx
          controls.target.z = nz
          controls.update()
          render()
        }
      }
      panRaf = requestAnimationFrame(panTick)
    })

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

    // Ground: textured with the same minimap image the 2D view uses, plus an
    // approximate heightmap displacement (see generate-terrain-heightmap.ts)
    // for subtle cliff/rock relief. MeshStandardMaterial (not Basic) so the
    // lighting/shadows above actually show up on it.
    const groundGeom = new THREE.PlaneGeometry(
      WORLD_SIZE,
      WORLD_SIZE,
      GROUND_SEGMENTS,
      GROUND_SEGMENTS,
    )
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

    // Terrain height lookup, shared by the ground displacement below and by
    // marker placement further down so buildings/heroes/creeps sit on the
    // surface instead of floating above or sinking into raised ground.
    // Defaults to flat (0) until the heightmap asset arrives.
    let heightGrid: { size: number; data: number[] } | null = null
    function groundHeightAt(worldX: number, worldZ: number): number {
      if (!heightGrid) return 0
      // Inverse of the ground's rotation.x = -PI/2 (world x = local x,
      // world z = -local y), then into the same 0..1 grid space the
      // heightmap script sampled the source image with.
      const u = worldX / WORLD_SIZE + 0.5
      const v = -worldZ / WORLD_SIZE + 0.5
      const { size, data } = heightGrid
      const gx = Math.min(size - 1, Math.max(0, Math.floor(u * size)))
      const gy = Math.min(size - 1, Math.max(0, Math.floor((1 - v) * size)))
      return (data[gy * size + gx] ?? 0) * MAX_TERRAIN_HEIGHT
    }

    // Static markers (buildings/wards/runes) are placed once, before the
    // heightmap fetch below can possibly resolve, so their positions are
    // recomputed once it lands. Heroes/creeps reposition every frame in
    // update(t) already, so they pick up real heights automatically.
    const groundedMarkers: { mesh: THREE.Object3D; x: number; z: number; baseY: number }[] = []
    function applyGroundHeights() {
      for (const { mesh, x, z, baseY } of groundedMarkers) {
        mesh.position.y = baseY + groundHeightAt(x, z)
      }
    }
    fetch(TERRAIN_HEIGHTMAP_URL)
      .then((res) => res.json())
      .then((json: { size: number; heights: number[] }) => {
        if (disposed) return
        heightGrid = { size: json.size, data: json.heights }
        const pos = groundGeom.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          // Displacing local Z (before the -90deg X rotation) is what ends
          // up as world-up Y afterward, verified against the rotation math.
          pos.setZ(i, groundHeightAt(pos.getX(i), -pos.getY(i)))
        }
        pos.needsUpdate = true
        groundGeom.computeVertexNormals()
        applyGroundHeights()
        render()
      })
      .catch(() => {
        // Missing/broken heightmap just leaves the ground flat, not fatal.
      })

    // Buildings: each is a Group, positioned/toggled exactly like the old
    // box/cone primitives so groundedMarkers/visibility logic doesn't need
    // to change; the real model is added as a child once its kind's glTF
    // loads (shared once per kind, cloned per building, see the gltfLoader
    // section further down where decalGeom/decalMaterial/makeDecal exist).
    const buildingMeshes = BUILDINGS.map((b) => {
      const { x, z } = toScene(b.x, b.y)
      const group = new THREE.Group()
      group.position.set(x, groundHeightAt(x, z), z)
      scene.add(group)
      groundedMarkers.push({ mesh: group, x, z, baseY: 0 })
      return group
    })

    // Observer wards: fixed position, only visibility changes over time.
    const wardMeshes = wardLives.map((wLife) => {
      const { x, z } = toScene(wLife.x, wLife.y)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#f2c94c' }),
      )
      mesh.position.set(x, 0.9 + groundHeightAt(x, z), z)
      mesh.visible = false
      scene.add(mesh)
      groundedMarkers.push({ mesh, x, z, baseY: 0.9 })
      return mesh
    })

    // Rune spawn spots: static landmarks (see runes.ts), always visible,
    // not a simulated spawn/despawn timer.
    const runeMeshes = RUNE_SPOTS.map((r) => {
      const { x, z } = toScene(r.x, r.y)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshBasicMaterial({ color: r.kind === 'bounty' ? '#c8961e' : '#5aaadc' }),
      )
      mesh.position.set(x, 0.7 + groundHeightAt(x, z), z)
      scene.add(mesh)
      groundedMarkers.push({ mesh, x, z, baseY: 0.7 })
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

    // Real static building models (no animation), one glTF loaded once per
    // kind and cloned into each matching building's Group (see buildingMeshes
    // above). A team-colored ground decal substitutes for tinting the
    // model's own stone/wood textures, same convention as heroes/creeps.
    const BUILDING_TARGET_HEIGHT: Record<(typeof BUILDINGS)[number]['kind'], number> = {
      tower: 3,
      rax: 2.6,
      fort: 4.4,
    }
    for (const kind of Object.keys(BUILDING_MODEL_URL) as (keyof typeof BUILDING_MODEL_URL)[]) {
      gltfLoader.load(BUILDING_MODEL_URL[kind]).then((gltf) => {
        if (disposed) return
        BUILDINGS.forEach((b, i) => {
          if (b.kind !== kind) return
          const model = gltf.scene.clone()
          fitHeight(model, BUILDING_TARGET_HEIGHT[kind])
          model.traverse((node) => {
            if (node instanceof THREE.Mesh) node.castShadow = true
          })
          // Rest the model's own base on the group's local origin (the
          // ground), whatever its authored pivot point was.
          const box = new THREE.Box3().setFromObject(model)
          model.position.y -= box.min.y
          buildingMeshes[i].add(model)
          // Not makeDecal(): that adds straight to the scene at world
          // position, this decal needs to be a child of the building's
          // Group instead, positioned in its local space.
          const decalColor = b.team === 'radiant' ? CANVAS_COLOR.green : CANVAS_COLOR.red
          const decal = new THREE.Mesh(decalGeom, decalMaterial(decalColor))
          decal.rotation.x = -Math.PI / 2
          decal.scale.setScalar(2.2)
          decal.position.y = 0.02
          buildingMeshes[i].add(decal)
        })
        render()
      })
    }

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
          const g = groundHeightAt(x, z)
          entry.sprite.position.set(x, 3.6 + g, z)
          entry.decal.position.set(x, 0.03 + g, z)
          if (entry.model) {
            entry.model.root.position.set(x, g, z)
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
        const g = groundHeightAt(x, z)
        entry.decal.visible = true
        entry.decal.position.set(x, 0.03 + g, z)
        if (entry.model) {
          entry.model.root.visible = true
          entry.model.root.position.set(x, g, z)
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
      cancelAnimationFrame(panRaf)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)

      groundMat.map?.dispose()
      groundGeom.dispose()
      groundMat.dispose()
      // buildingMeshes are Groups whose children (models, decals) share
      // geometry/material with decalGeom/decalMatCache and the cached glTFs
      // below, both disposed once globally further down, not per-building.
      for (const mesh of wardMeshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const mesh of runeMeshes) {
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
