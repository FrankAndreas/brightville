import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HOUSE_DEPTH, HOUSE_WIDTH, facingAngle, footprint, type DoorDef } from './doors'
import { houseParts, wallHeight, type HouseSpec } from './houseKit'
import { mergeParts, type PlacedPart } from './merge'
import { CAMERA_RAY_GROUPS, UNSEEN_GROUPS } from './groups'
import { NATURE_SEED, buildNature, placeNature } from './nature'
import { buildDistrictProps } from './districtLook'
import {
  ALL_SCENERY, ALL_STREETS, BOUNDS, DISTRICTS, EMPTY_LOTS, JETTY, LAKE, OUTLINE, PLAZA, hedgeSegments, heightAt, sceneryArea, streetDistance,
} from './map'

export { hedgeSegments }

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
  dirt: 0xb98f5e,
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

export interface BuildingLook { wall: number; roof: number; seed: number }
/**
 * Each door building's colours (each its own, warm, close to the colour it always had) and the seed of its house's
 * shape, by building id: she knows the buildings by colour, so
 * adding, removing or moving one in the registry changes no other building. (The seeds are the places they had in the
 * list when these were fixed.) A new building gets its own entry here.
 */
export const BUILDING_LOOKS: Record<string, BuildingLook> = {
  school: { wall: 0xc9b2ff, roof: 0x8a63e8, seed: 101 },
  schreiben: { wall: 0xffd98a, roof: 0xf08a3c, seed: 102 },
  yoga: { wall: 0xa9d4fa, roof: 0x5f9fd6, seed: 103 },
  unterschiede: { wall: 0xb5e8be, roof: 0x4fb862, seed: 104 },
  bibliothek: { wall: 0xf0cfa0, roof: 0xb0702a, seed: 105 },
  farblabor: { wall: 0xb9dcf7, roof: 0x4a6f9e, seed: 106 },
  ausmalen: { wall: 0xffe58a, roof: 0xf2a100, seed: 107 },
  malen: { wall: 0xa8e3db, roof: 0x1f9488, seed: 108 },
  huepfhalle: { wall: 0xffb3cf, roof: 0xf0668f, seed: 109 },
  tanzsaal: { wall: 0xd9bcff, roof: 0x8a44b0, seed: 110 },
  arcade: { wall: 0xffc0dc, roof: 0xe8509c, seed: 111 },
  schlange: { wall: 0x4a4a78, roof: 0xc92a2a, seed: 112 },
  bonbonjagd: { wall: 0xb8c0ff, roof: 0x5c6bd6, seed: 113 },
  kino: { wall: 0xffc48a, roof: 0xd9622b, seed: 114 },
  haus: { wall: 0x9fe0f0, roof: 0x3a9cb5, seed: 115 },
  laden: { wall: 0xc0f0a0, roof: 0x7cbf3a, seed: 116 },
  moebel: { wall: 0xe8c3a0, roof: 0x8c5a2b, seed: 117 },
  flatterflug: { wall: 0xb3f0ff, roof: 0x2fa8c9, seed: 118 },
  reimhaus: { wall: 0xfff3b0, roof: 0xc77d2e, seed: 119 },
  muster: { wall: 0xc6f0e6, roof: 0x3a8f7f, seed: 120 },
  kalender: { wall: 0xffd0e0, roof: 0xc2477a, seed: 121 },
  spielwelt: { wall: 0xdcd0ff, roof: 0x6a4fc4, seed: 122 },
  trommelhaus: { wall: 0xffd9ec, roof: 0xd2557f, seed: 123 },
}

/** A building's look; one not in the table gets a grey one rather than failing */
export function lookOf(id: string): BuildingLook {
  return BUILDING_LOOKS[id] ?? { wall: 0xdddddd, roof: 0x888888, seed: 999 }
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
    // A camera-only box she stands under or right against (a tree's crown, an awning) is skipped: from there every
    // ray would meet it, and the camera would end up above it, hiding her completely
    const under = (c: RAPIER.Collider) => c.isSensor() && c.containsPoint({ x: from.x, y: c.translation().y, z: from.z })
    const hit = world.castRay(
      ray, length, true, R.QueryFilterFlags.EXCLUDE_DYNAMIC | R.QueryFilterFlags.EXCLUDE_KINEMATIC, CAMERA_RAY_GROUPS,
      undefined, undefined, c => !under(c),
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
  // house with its roof, and 0.6 m out at the front for awnings and balconies (houseKit.test.ts keeps every part
  // inside it), so none of them hides her. Sides and back reach out only for the roof's eaves
  const top = h * 1.6
  const out = { front: 0.6, rest: 0.25 }
  const shift = (out.front - out.rest) / 2
  world.createCollider(
    R.ColliderDesc.cuboid(
      (turned ? d / 2 + out.rest + shift : w / 2 + out.rest), top / 2, (turned ? w / 2 + out.rest : d / 2 + out.rest + shift),
    )
      .setTranslation(x + Math.sin(angle) * shift, top / 2, z + Math.cos(angle) * shift)
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
  R: Rapier, world: RAPIER.World, scene: THREE.Scene, parts: PlacedPart[], door: DoorDef,
): DoorVisual {
  const depth = HOUSE_DEPTH
  const side = door.side ?? 'back'
  const area = footprint(door)
  const { wall, roof: roofColor, seed } = lookOf(door.id)
  const group = house(
    R, world, scene, parts, (area.minX + area.maxX) / 2, (area.minZ + area.maxZ) / 2,
    { w: HOUSE_WIDTH, d: depth, floors: 2, wall, roof: roofColor, seed, door: true }, facingAngle(side),
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
  /** Moves what moves by itself in the town (the workshop's crane), `timeS` seconds in */
  update(timeS: number): void
  sun: THREE.DirectionalLight
  /** Moves the sun with her: its shadows cover only the town around her, sharp enough on a tablet */
  followSun(x: number, z: number): void
}

/** The sun's offset from where it shines, and how far around her it casts shadows */
const SUN_OFFSET = { x: 14, y: 26, z: 12 }
const SHADOW_HALF = 22
const SHADOW_MAP = 2048

/**
 * The ground: a heightfield for the physics and a matching mesh, both sampled from `heightAt`, over the town's whole
 * bounding box. Each area of the town is coloured its own (from the districts' data), grass beyond the outline.
 */
function ground(R: Rapier, world: RAPIER.World, scene: THREE.Scene) {
  const nx = Math.round((BOUNDS.maxX - BOUNDS.minX) / GROUND_STEP)
  const nz = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / GROUND_STEP)
  const sizeX = nx * GROUND_STEP
  const sizeZ = nz * GROUND_STEP
  const cx = BOUNDS.minX + sizeX / 2
  const cz = BOUNDS.minZ + sizeZ / 2
  const geometry = new THREE.PlaneGeometry(sizeX, sizeZ, nx, nz)
  // The plane lies in x/y around its middle and is turned to lie flat: its y becomes -z, its z the height
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    const x = cx + position.getX(i)
    const z = cz - position.getY(i)
    position.setZ(i, heightAt(x, z))
    const area = OUTLINE.find(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)
    color.setHex(area?.ground ?? COLORS.grass)
    colors.set([color.r, color.g, color.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  mesh.name = 'ground'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(cx, 0, cz)
  mesh.receiveShadow = true
  scene.add(mesh)

  // Rapier's heightfield: its rows run along z and its columns along x, the heights column by column, so the one at
  // i · (nz + 1) + j is at x step i and z step j (checked by world.test.ts on every hill)
  const heights = new Float32Array((nx + 1) * (nz + 1))
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) heights[i * (nz + 1) + j] = heightAt(BOUNDS.minX + i * GROUND_STEP, BOUNDS.minZ + j * GROUND_STEP)
  }
  world.createCollider(R.ColliderDesc.heightfield(nz, nx, heights, { x: sizeX, y: 1, z: sizeZ }).setTranslation(cx, 0, cz))
  // A floor under it all, so nothing that slips through falls forever
  staticBox(R, world, cx, -0.5, cz, sizeX, 1, sizeZ)
}

function disc(scene: THREE.Scene, x: number, z: number, rx: number, rz: number, color: number, y: number, material?: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), material ?? new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(rx, rz, 1)
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  scene.add(mesh)
}

/** A flat strip from a to b, `width` wide, as a geometry lying at height `y` */
function stripGeometry(a: { x: number; z: number }, b: { x: number; z: number }, width: number, y: number): THREE.BufferGeometry {
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  return new THREE.PlaneGeometry(width, length)
    .rotateX(-Math.PI / 2)
    .rotateY(Math.atan2(b.x - a.x, b.z - a.z))
    .translate((a.x + b.x) / 2, y, (a.z + b.z) / 2)
}

/** A round patch at (x, z), as a geometry lying at height `y` */
function discGeometry(x: number, z: number, radius: number, y: number): THREE.BufferGeometry {
  return new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2).translate(x, y, z)
}

/**
 * Every district's streets, paved or dirt, each kind in one mesh; dirt lies just under the paving where they meet.
 * Bends are rounded, and so is a street's end where it runs into another (the back avenue's end at the forest
 * crossing); dead ends stay square.
 */
function streets(scene: THREE.Scene) {
  disc(scene, PLAZA.x, PLAZA.z, PLAZA.radius, PLAZA.radius, COLORS.plaza, 0.014)
  for (const kind of [undefined, 'dirt'] as const) {
    const y = kind === 'dirt' ? 0.011 : 0.012
    const pieces: THREE.BufferGeometry[] = []
    for (const s of ALL_STREETS.filter(s => s.kind === kind)) {
      for (let i = 1; i < s.points.length; i++) pieces.push(stripGeometry(s.points[i - 1], s.points[i], s.width, y))
      const others = ALL_STREETS.filter(o => o !== s).map(o => ({ ...o, width: 0 }))
      const ends = [s.points[0], s.points[s.points.length - 1]].filter(p => streetDistance(p.x, p.z, others) < 1e-6)
      for (const p of [...s.points.slice(1, -1), ...ends]) pieces.push(discGeometry(p.x, p.z, s.width / 2, y))
    }
    const geometry = mergeGeometries(pieces)
    for (const p of pieces) p.dispose()
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: kind === 'dirt' ? COLORS.dirt : COLORS.path, roughness: 1 }))
    mesh.receiveShadow = true
    scene.add(mesh)
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

/**
 * Low hedge you see, tall barrier you don't: along `hedgeSegments`, round the outline and between the old town and
 * each district, open at the gates. The hedge's pieces are one merged mesh. Each piece reaches half its thickness past
 * its ends to close the corners, but not into a gate.
 */
function edge(R: Rapier, world: RAPIER.World, scene: THREE.Scene) {
  const thick = 1
  const gates = DISTRICTS.flatMap(d => (d.gate ? [d.gate] : []))
  const gateEnd = (p: { x: number; z: number }) => gates.some(g => Math.abs(Math.hypot(p.x - g.x, p.z - g.z) - g.width / 2) < 1e-6)
  const parts: PlacedPart[] = []
  const at = new THREE.Matrix4()
  for (const { a, b } of hedgeSegments()) {
    const alongX = a.z === b.z
    const from = (alongX ? a.x : a.z) - (gateEnd(a) ? 0 : thick / 2)
    const to = (alongX ? b.x : b.z) + (gateEnd(b) ? 0 : thick / 2)
    const mid = (from + to) / 2
    const [x, z] = alongX ? [mid, a.z] : [a.x, mid]
    const [w, d] = alongX ? [to - from, thick] : [thick, to - from]
    parts.push({ kind: 'trim', x, y: HEDGE_HEIGHT / 2, z, w, h: HEDGE_HEIGHT, d, color: COLORS.hedge, at })
    staticBox(R, world, x, BARRIER_HEIGHT / 2, z, w, BARRIER_HEIGHT, d, true)
  }
  for (const mesh of mergeParts(parts, Infinity)) scene.add(mesh)
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

  // Every house's boxes, and the districts' props, merged into a few meshes once all are placed
  const parts: PlacedPart[] = []
  ALL_SCENERY.forEach((h, i) => {
    const f = sceneryArea(h)
    const [wall, roof] = h.look ? [h.look.wall, h.look.roof] : COLORS.houses[i % COLORS.houses.length]
    house(
      R, world, scene, parts, (f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2,
      { w: h.w, d: h.d, floors: h.floors, wall, roof, seed: i + 1, door: false }, facingAngle(h.spot.side ?? 'back'),
    )
  })
  const doorVisuals = doors.map(door => doorBuilding(R, world, scene, parts, door))
  const props = buildDistrictProps(R, world, scene, parts)
  for (const mesh of mergeParts(parts)) scene.add(mesh)
  buildNature(R, world, scene, placeNature(NATURE_SEED, doors))

  return { scene, doorVisuals, sun, followSun, update: props.update }
}

/** Frees everything the town drew: geometries, materials, their textures and the signs' spare textures */
export function disposeScene(scene: THREE.Scene) {
  scene.traverse(object => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    // Trees, lamps, flowers: their matrices and colours are buffers of the mesh's own
    if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose()
    for (const t of (object.userData.textures as THREE.Texture[] | undefined) ?? []) t.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose()
      m.dispose()
    }
  })
}
