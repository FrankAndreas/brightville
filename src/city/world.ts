import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { HOUSE_DEPTH, HOUSE_WIDTH, facingAngle, footprint, type DoorDef } from './doors'
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
  houses: [0xffc8dd, 0xbde0fe, 0xfde4a8],
  roofs: [0xff8fab, 0x8ecae6, 0xf4a261],
  // One wall and roof colour per door building, in the order of the doors
  buildings: [
    [0xd9c8ff, 0xa58bf0], [0xfde4a8, 0xf4a261], [0xbde0fe, 0x8ecae6], [0xc8f0d0, 0x6bcb77],
    [0xf3dfc1, 0xc08a2e], [0xd6ecff, 0x5c7fa8],
    [0xfff1b8, 0xffb703], [0xcdeeea, 0x26a69a], [0xffc8dd, 0xff8fab], [0xe5d4ff, 0x9b59b6], [0xffd6e8, 0xff69b4],
    [0x3d3d5c, 0xd62828],
  ],
  leafOpen: 0x6b4a2b,
  leafClosed: 0x8a8a8a,
  doorOpen: 0xffd93d,
  doorClosed: 0xb8b8b8,
}

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

function staticBox(R: Rapier, world: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number) {
  world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z))
}

/** A house of w × d (along x and z before turning) and h high, turned by `angle` about its middle. */
function house(
  R: Rapier, world: RAPIER.World, scene: THREE.Scene,
  x: number, z: number, w: number, h: number, d: number, color: number, roofColor: number, angle = 0,
): THREE.Group {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = angle
  const walls = box(w, h, d, color)
  walls.position.y = h / 2
  // A four-sided roof fitted to the walls with a small overhang
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1, h * 0.6, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9, flatShading: true }),
  )
  cone.rotation.y = Math.PI / 4
  cone.castShadow = true
  const roof = new THREE.Group()
  roof.add(cone)
  roof.position.y = h + h * 0.3
  roof.scale.set(w * 0.78, 1, d * 0.78)
  group.add(walls, roof)
  scene.add(group)
  // Only quarter turns: a turned house swaps its width and depth
  const turned = Math.abs(Math.sin(angle)) > 0.5
  staticBox(R, world, x, h / 2, z, turned ? d : w, h, turned ? w : d)
  return group
}

// A round sign with the building's picture, readable without words
function sign(icon: string): THREE.Mesh {
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
    g.font = `${size * 0.55}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(icon, size / 2, size / 2 + 8)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 40),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  )
}

/** The building behind a door: a larger house with a sign and a door that glows when open. */
function doorBuilding(R: Rapier, world: RAPIER.World, scene: THREE.Scene, door: DoorDef, index: number): DoorVisual {
  const depth = HOUSE_DEPTH
  const side = door.side ?? 'back'
  const area = footprint(door)
  const [wall, roofColor] = COLORS.buildings[index % COLORS.buildings.length]
  const group = house(
    R, world, scene, (area.minX + area.maxX) / 2, (area.minZ + area.maxZ) / 2,
    HOUSE_WIDTH, 5, depth, wall, roofColor, facingAngle(side),
  )

  const frame = box(2.2, 2.9, 0.2, COLORS.doorOpen)
  frame.position.set(0, 1.45, depth / 2 + 0.05)
  const leaf = box(1.7, 2.5, 0.22, COLORS.leafOpen)
  leaf.position.set(0, 1.25, depth / 2 + 0.07)
  group.add(frame, leaf)

  // The camera always looks from behind, so a door on a side is seen from its edge:
  // side houses hang their sign out from the wall, facing the camera, like a shop sign. It hangs on the
  // camera side of the door, so the sign of the next house along is behind the camera, not in the picture
  const board = new THREE.Group()
  if (side === 'back' || side === 'front') {
    // On the house, above the door: turned with it, so the front house shows its sign to a child who turned round
    board.position.set(0, 3.95, depth / 2 + 0.06)
    group.add(board)
  } else {
    const out = side === 'left' ? 1 : -1
    const wallX = side === 'left' ? area.maxX : area.minX
    const bracket = box(1.5, 0.12, 0.12, 0x6b4a2b)
    bracket.position.set(wallX + out * 0.75, 4.15, door.z + 1.6)
    scene.add(bracket)
    board.position.set(wallX + out * 1.2, 3.25, door.z + 1.6)
    scene.add(board)
  }
  if (door.icon) board.add(sign(door.icon))
  const lock = sign('🔒')
  // A badge on the corner of the sign, so the door itself stays readable
  lock.scale.setScalar(0.6)
  lock.position.set(0.85, -0.65, 0.06)
  board.add(lock)

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
    lock.visible = locked
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
}

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
  for (const x of [JETTY.minX - 0.2, JETTY.maxX + 0.2]) staticBox(R, world, x, BARRIER_HEIGHT / 2, JETTY.maxZ - over / 2, 0.4, BARRIER_HEIGHT, over)
  staticBox(R, world, (JETTY.minX + JETTY.maxX) / 2, BARRIER_HEIGHT / 2, JETTY.maxZ + 0.2, JETTY.maxX - JETTY.minX + 0.8, BARRIER_HEIGHT, 0.4)
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
    staticBox(R, world, x, BARRIER_HEIGHT / 2, z, w, BARRIER_HEIGHT, d)
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
  sun.position.set(14, 26, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 6
  const cam = sun.shadow.camera
  cam.left = cam.bottom = -TOWN_HALF - 4
  cam.right = cam.top = TOWN_HALF + 4
  cam.near = 1
  cam.far = 120
  scene.add(sun)

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

  SCENERY_HOUSES.forEach((h, i) => {
    const f = sceneryArea(h)
    house(
      R, world, scene, (f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2, h.w, h.floors * 2.6 + 0.4, h.d,
      COLORS.houses[i % COLORS.houses.length], COLORS.roofs[i % COLORS.roofs.length], facingAngle(h.spot.side ?? 'back'),
    )
  })

  return { scene, doorVisuals: doors.map((door, i) => doorBuilding(R, world, scene, door, i)) }
}
