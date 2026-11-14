import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { HOUSE_DEPTH, HOUSE_WIDTH, facingAngle, footprint, type DoorDef } from './doors'
import { houseParts, wallHeight, type HouseSpec } from './houseKit'
import { mergeParts, type PlacedPart } from './merge'
import { EMPTY_LOTS, JETTY, LAKE, PLAZA, SCENERY_HOUSES, STREETS, TOWN_HALF, heightAt, sceneryArea } from './map'

type Rapier = typeof RAPIER

export const GRAVITY = 10
const HEDGE_HEIGHT = 1.2
/** The ground is sampled every metre, for the picture and for the physics alike */
const GROUND_STEP = 1
// The real barrier is much taller than the wall you see, so no trampoline
// bounce carries anyone out of the world
const BARRIER_HEIGHT = 30

const COLORS = {
  sky: 0xbfe7ff,
  grass: 0xb8e6a3,
  path: 0xe9dcc0,
  plaza: 0xf6e7c1,
  hedge: 0x5fa35a,
  water: 0x5fb3e8,
  shore: 0xf3e2b3,
  wood: 0xa0703f,
  garden: 0x9fd58c,
  // The houses that are just houses: warm row-house colours, wall and roof
  houses: [
    [0xf4a259, 0x9c4a1a], [0xb39ddb, 0x5e3a8c], [0x7fc8b8, 0x2f7d6d], [0xf6c85f, 0xb5651d],
    [0xef8a80, 0x8e3b46], [0x9fc97a, 0x4f7a2b], [0x8fb8e8, 0x3d5a99], [0xe8a0c8, 0x8a3f6f],
  ] as [number, number][],
  leafOpen: 0x6b4a2b,
  leafClosed: 0x8a8a8a,
  doorOpen: 0xffd93d,
  doorClosed: 0xb8b8b8,
}

/**
 * One wall and roof colour per door building, in the order of the registry: each its own, warmer than the pastels
 * before, and close to the colour it had so she still knows it
 */
export const BUILDING_COLORS: [wall: number, roof: number][] = [
  [0xc9b2ff, 0x8a63e8], [0xffd98a, 0xf08a3c], [0xa9d4fa, 0x5f9fd6], [0xb5e8be, 0x4fb862],
  [0xf0cfa0, 0xb0702a], [0xb9dcf7, 0x4a6f9e], [0xffe58a, 0xf2a100], [0xa8e3db, 0x1f9488],
  [0xffb3cf, 0xf0668f], [0xd9bcff, 0x8a44b0], [0xffc0dc, 0xe8509c], [0x4a4a78, 0xc92a2a],
  [0xb8c0ff, 0x5c6bd6], [0xffc48a, 0xd9622b], [0x9fe0f0, 0x3a9cb5], [0xc0f0a0, 0x7cbf3a],
  [0xe8c3a0, 0x8c5a2b], [0xb3f0ff, 0x2fa8c9],
]

export interface DoorVisual {
  /** Pulses the glowing ring of an open door */
  update(timeS: number): void
  /** Repaints the door: glowing when open, grey when closed, with a lock when locked */
  setState(open: boolean, locked: boolean): void
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Collision groups (16 bits "member of", 16 bits "meets"): the invisible walls are members of group 2 only, so the
 * camera's ray (meeting group 1 only) looks through them, while she and the balls still bump into them
 */
const UNSEEN_GROUPS = 0x0002ffff
const CAMERA_RAY_GROUPS = 0xffff0001

function staticBox(
  R: Rapier, world: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number, unseen = false,
) {
  const desc = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z)
  if (unseen) desc.setCollisionGroups(UNSEEN_GROUPS)
  world.createCollider(desc)
}

/**
 * How far from `from` towards `to` the first house, hill or block is, or null when the way is clear: the camera
 * moves in front of it. Invisible walls, balls and she herself don't count.
 */
export function cameraBlocker(R: Rapier, world: RAPIER.World) {
  return (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): number | null => {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    const length = Math.hypot(d.x, d.y, d.z)
    if (length < 1e-6) return null
    const ray = new R.Ray(from, { x: d.x / length, y: d.y / length, z: d.z / length })
    const hit = world.castRay(
      ray, length, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC, CAMERA_RAY_GROUPS,
    )
    return hit ? hit.timeOfImpact : null
  }
}

/**
 * A house from the kit (houseKit.ts), turned by `angle` about its middle: its boxes go into `parts`, to be merged with
 * all the others; the returned group stands where the house does, for what is added to it alone (a door that changes
 * colour). Solid walls for her, and a roof only the camera meets.
 */
function house(
  R: Rapier, world: RAPIER.World, scene: THREE.Scene, parts: PlacedPart[], x: number, z: number, spec: HouseSpec, angle = 0,
): THREE.Group {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = angle
  scene.add(group)
  group.updateMatrix()
  const at = group.matrix.clone()
  for (const part of houseParts(spec)) parts.push({ ...part, at })
  const { w, d } = spec
  const h = wallHeight(spec.floors)
  // Only quarter turns: a turned house swaps its width and depth
  const turned = Math.abs(Math.sin(angle)) > 0.5
  staticBox(R, world, x, h / 2, z, turned ? d : w, h, turned ? w : d)
  // For the camera only: a sensor nothing bumps into or stands on, but the camera's ray meets it, round the whole
  // house with its roof, awnings and balconies (houseKit.test.ts keeps every part inside it), so none of them hides her
  const top = h * 1.6
  world.createCollider(
    R.ColliderDesc.cuboid((turned ? d : w) / 2 + 0.6, top / 2, (turned ? w : d) / 2 + 0.6)
      .setTranslation(x, top / 2, z)
      .setSensor(true),
  )
  return group
}

// A round sign with the building's picture, readable without words; with a lock on its corner while locked
function signTexture(icon: string | undefined, locked: boolean): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 12
    g.strokeStyle = '#a58bf0'
    g.stroke()
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (icon) {
      g.font = `${size * 0.55}px sans-serif`
      g.fillText(icon, size / 2, size / 2 + 8)
    }
    if (locked) {
      // A badge on the lower right, so the picture stays readable
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(size * 0.8, size * 0.8, size * 0.19, 0, Math.PI * 2)
      g.fill()
      g.font = `${size * 0.26}px sans-serif`
      g.fillText('🔒', size * 0.8, size * 0.82)
    }
  }
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** The building behind a door: a larger house with a sign and a door that glows when open. */
function doorBuilding(
  R: Rapier, world: RAPIER.World, scene: THREE.Scene, parts: PlacedPart[], door: DoorDef, index: number,
): DoorVisual {
  const depth = HOUSE_DEPTH
  const side = door.side ?? 'back'
  const area = footprint(door)
  const [wall, roofColor] = BUILDING_COLORS[index % BUILDING_COLORS.length]
  const group = house(
    R, world, scene, parts, (area.minX + area.maxX) / 2, (area.minZ + area.maxZ) / 2,
    { w: HOUSE_WIDTH, d: depth, floors: 2, wall, roof: roofColor, seed: index + 101, door: true }, facingAngle(side),
  )

  const frame = box(2.2, 2.9, 0.2, COLORS.doorOpen)
  frame.position.set(0, 1.45, depth / 2 + 0.05)
  const leaf = box(1.7, 2.5, 0.22, COLORS.leafOpen)
  leaf.position.set(0, 1.25, depth / 2 + 0.07)
  group.add(frame, leaf)

  // The sign floats above the door and always faces the camera, so it is seen from every street and from afar
  const plain = signTexture(door.icon, false)
  const lockedTexture = signTexture(door.icon, true)
  const signMaterial = new THREE.SpriteMaterial({ map: plain, transparent: true })
  const sign = new THREE.Sprite(signMaterial)
  sign.scale.set(1.9, 1.9, 1)
  // Half a metre from the door spot towards the house, above the eaves
  const toHouse = { x: (area.minX + area.maxX) / 2 - door.x, z: (area.minZ + area.maxZ) / 2 - door.z }
  const length = Math.hypot(toHouse.x, toHouse.z) || 1
  sign.position.set(door.x + (toHouse.x / length) * 0.5, 6.2, door.z + (toHouse.z / length) * 0.5)
  // Both are freed with the town (city.ts), whichever is showing
  sign.userData.textures = [plain, lockedTexture]
  scene.add(sign)

  const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.doorOpen, transparent: true })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), ringMaterial)
  ring.rotation.x = -Math.PI / 2
  ring.position.set(door.x, 0.03, door.z)
  scene.add(ring)

  let isOpen = true
  const paint = (mesh: THREE.Mesh, color: number) => (mesh.material as THREE.MeshStandardMaterial).color.setHex(color)

  function setState(open: boolean, locked: boolean) {
    isOpen = open
    paint(frame, open ? COLORS.doorOpen : COLORS.doorClosed)
    paint(leaf, open ? COLORS.leafOpen : COLORS.leafClosed)
    ringMaterial.color.setHex(open ? COLORS.doorOpen : COLORS.doorClosed)
    ringMaterial.opacity = open ? 0.9 : 0.5
    signMaterial.map = locked ? lockedTexture : plain
    if (!open) ring.scale.set(1, 1, 1)
  }
  setState(door.open, door.locked ?? false)

  return {
    setState,
    update(timeS) {
      if (!isOpen) return
      const pulse = 1 + Math.sin(timeS * 3) * 0.08
      ring.scale.set(pulse, pulse, 1)
    },
  }
}

export interface Town {
  scene: THREE.Scene
  doorVisuals: DoorVisual[]
  sun: THREE.DirectionalLight
  /** Moves the sun with her: its shadows cover only the town around her, sharp enough on a tablet */
  followSun(x: number, z: number): void
}

/** The sun's offset from where it shines, and how far around her it casts shadows */
const SUN_OFFSET = { x: 14, y: 26, z: 12 }
const SHADOW_HALF = 22
const SHADOW_MAP = 2048

/** The ground: a heightfield for the physics and a matching mesh, both sampled from `heightAt` */
function ground(R: Rapier, world: RAPIER.World, scene: THREE.Scene) {
  const n = Math.round((TOWN_HALF * 2) / GROUND_STEP)
  const size = TOWN_HALF * 2
  const geometry = new THREE.PlaneGeometry(size, size, n, n)
  // The plane lies in x/y and is turned to lie flat: its y becomes -z, its z the height
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) position.setZ(i, heightAt(position.getX(i), -position.getY(i)))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }))
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  scene.add(mesh)

  // Rapier's heightfield: (n + 1)² heights centred on 0, the one at i · (n + 1) + j at x step i and z step j
  // (checked by world.test.ts on every hill)
  const heights = new Float32Array((n + 1) * (n + 1))
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) heights[i * (n + 1) + j] = heightAt(-TOWN_HALF + i * GROUND_STEP, -TOWN_HALF + j * GROUND_STEP)
  }
  world.createCollider(R.ColliderDesc.heightfield(n, n, heights, { x: size, y: 1, z: size }))
  // A floor under it all, so nothing that slips through falls forever
  staticBox(R, world, 0, -0.5, 0, size, 1, size)
}

/** A flat strip from a to b, `width` wide, lying just above the grass */
function strip(scene: THREE.Scene, a: { x: number; z: number }, b: { x: number; z: number }, width: number, color: number, y: number) {
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = -Math.atan2(b.x - a.x, -(b.z - a.z))
  mesh.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2)
  mesh.receiveShadow = true
  scene.add(mesh)
}

function disc(scene: THREE.Scene, x: number, z: number, rx: number, rz: number, color: number, y: number, material?: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), material ?? new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(rx, rz, 1)
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  scene.add(mesh)
}

function streets(scene: THREE.Scene) {
  disc(scene, PLAZA.x, PLAZA.z, PLAZA.radius, PLAZA.radius, COLORS.plaza, 0.014)
  for (const s of STREETS) {
    for (let i = 1; i < s.points.length; i++) strip(scene, s.points[i - 1], s.points[i], s.width, COLORS.path, 0.012)
    // Round corners where a street bends
    for (const p of s.points.slice(1, -1)) disc(scene, p.x, p.z, s.width / 2, s.width / 2, COLORS.path, 0.012)
  }
}

/**
 * The lake: water you see and a shore around it, and an invisible wall just inside the shore that nothing gets over
 * (as tall as the town's barrier), open only where the jetty goes in. The jetty is a deck with invisible walls along
 * its sides and end.
 */
function lake(R: Rapier, world: RAPIER.World, scene: THREE.Scene) {
  disc(scene, LAKE.x, LAKE.z, LAKE.rx + 1.2, LAKE.rz + 1.2, COLORS.shore, 0.008)
  const water = new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 })
  disc(scene, LAKE.x, LAKE.z, LAKE.rx, LAKE.rz, COLORS.water, 0.03, water)

  const pieces = 72
  for (let k = 0; k < pieces; k++) {
    const a0 = (k / pieces) * Math.PI * 2
    const a1 = ((k + 1) / pieces) * Math.PI * 2
    const p0 = { x: LAKE.x + Math.cos(a0) * LAKE.rx, z: LAKE.z + Math.sin(a0) * LAKE.rz }
    const p1 = { x: LAKE.x + Math.cos(a1) * LAKE.rx, z: LAKE.z + Math.sin(a1) * LAKE.rz }
    const mx = (p0.x + p1.x) / 2
    const mz = (p0.z + p1.z) / 2
    // The jetty's way in
    if (mx > JETTY.minX - 0.3 && mx < JETTY.maxX + 0.3 && mz > JETTY.minZ && mz < JETTY.maxZ) continue
    const length = Math.hypot(p1.x - p0.x, p1.z - p0.z) + 0.1
    world.createCollider(
      R.ColliderDesc.cuboid(length / 2, BARRIER_HEIGHT / 2, 0.2)
        .setCollisionGroups(UNSEEN_GROUPS)
        .setTranslation(mx, BARRIER_HEIGHT / 2, mz)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(p1.z - p0.z, p1.x - p0.x))),
    )
  }

  const deckHeight = 0.25
  const deck = box(JETTY.maxX - JETTY.minX, deckHeight, JETTY.maxZ - JETTY.minZ, COLORS.wood)
  deck.position.set((JETTY.minX + JETTY.maxX) / 2, deckHeight / 2, (JETTY.minZ + JETTY.maxZ) / 2)
  scene.add(deck)
  staticBox(R, world, deck.position.x, deckHeight / 2, deck.position.z, JETTY.maxX - JETTY.minX, deckHeight, JETTY.maxZ - JETTY.minZ)
  // Walls along the part over the water, and across the end
  const shore = LAKE.z - LAKE.rz * Math.sqrt(Math.max(0, 1 - (((JETTY.minX + JETTY.maxX) / 2 - LAKE.x) / LAKE.rx) ** 2))
  const over = JETTY.maxZ - shore + 1
  for (const x of [JETTY.minX - 0.2, JETTY.maxX + 0.2]) staticBox(R, world, x, BARRIER_HEIGHT / 2, JETTY.maxZ - over / 2, 0.4, BARRIER_HEIGHT, over, true)
  staticBox(R, world, (JETTY.minX + JETTY.maxX) / 2, BARRIER_HEIGHT / 2, JETTY.maxZ + 0.2, JETTY.maxX - JETTY.minX + 0.8, BARRIER_HEIGHT, 0.4, true)
}

/** Low hedge you see, tall barrier you don't */
function edge(R: Rapier, world: RAPIER.World, scene: THREE.Scene) {
  const sides: [number, number, number, number][] = [
    [0, -TOWN_HALF, TOWN_HALF * 2, 1], [0, TOWN_HALF, TOWN_HALF * 2, 1],
    [-TOWN_HALF, 0, 1, TOWN_HALF * 2], [TOWN_HALF, 0, 1, TOWN_HALF * 2],
  ]
  for (const [x, z, w, d] of sides) {
    const hedge = box(w, HEDGE_HEIGHT, d, COLORS.hedge)
    hedge.position.set(x, HEDGE_HEIGHT / 2, z)
    scene.add(hedge)
    staticBox(R, world, x, BARRIER_HEIGHT / 2, z, w, BARRIER_HEIGHT, d, true)
  }
}

/** Builds the town from the map: ground, streets, lake, hedge, lights, scenery houses and one building per door. */
export function buildTown(R: Rapier, world: RAPIER.World, doors: DoorDef[]): Town {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.sky)
  // Far streets fade into the sky
  scene.fog = new THREE.Fog(COLORS.sky, 55, 110)

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8e6a3, 1.6))
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP)
  sun.shadow.radius = 6
  const cam = sun.shadow.camera
  cam.left = cam.bottom = -SHADOW_HALF
  cam.right = cam.top = SHADOW_HALF
  cam.near = 1
  cam.far = 80
  scene.add(sun, sun.target)
  // In whole shadow texels along the sun's own axes (it looks at the town at a slant), so the shadows' edges don't
  // shimmer as she walks
  const texel = (SHADOW_HALF * 2) / SHADOW_MAP
  const forward = new THREE.Vector3(-SUN_OFFSET.x, -SUN_OFFSET.y, -SUN_OFFSET.z).normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  const her = new THREE.Vector3()
  function followSun(x: number, z: number) {
    her.set(x, 0, z)
    const r = Math.round(her.dot(right) / texel) * texel
    const u = Math.round(her.dot(up) / texel) * texel
    sun.target.position.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(forward, her.dot(forward))
    sun.position.copy(sun.target.position).add(new THREE.Vector3(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z))
    sun.target.updateMatrixWorld()
  }
  followSun(0, 0)

  ground(R, world, scene)
  streets(scene)
  lake(R, world, scene)
  edge(R, world, scene)

  // Gardens on the lots kept for buildings still to come
  for (const lot of EMPTY_LOTS) {
    const f = footprint(lot)
    const garden = new THREE.Mesh(new THREE.PlaneGeometry(f.maxX - f.minX, f.maxZ - f.minZ), new THREE.MeshStandardMaterial({ color: COLORS.garden, roughness: 1 }))
    garden.rotation.x = -Math.PI / 2
    garden.position.set((f.minX + f.maxX) / 2, 0.01, (f.minZ + f.maxZ) / 2)
    garden.receiveShadow = true
    scene.add(garden)
  }

  // Every house's boxes, merged into a few meshes once all are placed
  const parts: PlacedPart[] = []
  SCENERY_HOUSES.forEach((h, i) => {
    const f = sceneryArea(h)
    const [wall, roof] = COLORS.houses[i % COLORS.houses.length]
    house(
      R, world, scene, parts, (f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2,
      { w: h.w, d: h.d, floors: h.floors, wall, roof, seed: i + 1, door: false }, facingAngle(h.spot.side ?? 'back'),
    )
  })
  const doorVisuals = doors.map((door, i) => doorBuilding(R, world, scene, parts, door, i))
  for (const mesh of mergeParts(parts)) scene.add(mesh)

  return { scene, doorVisuals, sun, followSun }
}

/** Frees everything the town drew: geometries, materials, their textures and the signs' spare textures */
export function disposeScene(scene: THREE.Scene) {
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    for (const t of (object.userData.textures as THREE.Texture[] | undefined) ?? []) t.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose()
      m.dispose()
    }
  })
}
