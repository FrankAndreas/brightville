import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { DOOR_RADIUS, footprint, type DoorSpot, type Footprint } from './doors'
import {
  ALL_PROPS, ALL_SCENERY, ALL_STREETS, EMPTY_LOTS, HILLS, JETTY, LAKE, PLAZA, TOWN_HALF, hedgeDistance, heightAt, inTown,
  propArea, sceneryArea, streetDistance,
} from './map'
import { CLEARING, FIELD, NATURE, PENS } from './districts/nature'
import { BLOCKS, TRAMPOLINES } from './props'
import { UNSEEN_GROUPS } from './groups'

type Rapier = typeof RAPIER

/**
 * Trees, bushes, flower beds, garden and pen fences, street lamps and benches: placed by rules (never on a street, in
 * the lake, in front of a door or on a lot a building may come to), the same every time. The districts get their own:
 * a dense forest, a few trees on the farm, its pens, and lamps along their paved streets. Trees, lamps and benches are
 * solid; bushes, flowers and fences are not (she walks through, as through tall grass).
 */
export type NatureKind = 'tree' | 'bush' | 'flowers' | 'fence' | 'lamp' | 'bench'

export interface NatureItem {
  kind: NatureKind
  x: number
  z: number
  rotY: number
  /** Size for trees and bushes, length for a fence */
  scale: number
  /** Blossom or leaf colour */
  color: number
}

export const NATURE_SEED = 7
export const SOLID_KINDS = new Set<NatureKind>(['tree', 'lamp', 'bench'])

const BLOSSOMS = [0xff5d8f, 0xffb703, 0xb5179e, 0xff8c42, 0xffffff, 0x7b2cbf]
const LEAVES = [0x4caf50, 0x6abf4b, 0x3f9142, 0x8bc34a]
/** Where a lamp stands: this far from the paving */
const LAMP_OFFSET = 0.6
const LAMP_EVERY = 12
/** Trunks and lamp posts are solid this high, far above any crown or lamp: nothing lands on them */
const PILLAR = 30
/** The bench's seat, where she can sit (stand) */
const SEAT = 0.51

/** How far each item reaches out from its middle, for sinking it into a slope */
const REACH: Record<NatureKind, number> = { tree: 0.3, bush: 0.6, flowers: 0.7, fence: 0.1, lamp: 0.1, bench: 0.8 }

/** The lowest ground under an item: it stands there, so on a slope nothing floats on the downhill side */
export function groundUnder(i: NatureItem): number {
  const r = REACH[i.kind] * (i.kind === 'fence' ? 1 : i.scale)
  let low = heightAt(i.x, i.z)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    low = Math.min(low, heightAt(i.x + dx * r, i.z + dz * r))
  }
  return low
}

/** The ground a solid item takes (a bench as a square round its length, whichever way it is turned) */
export function natureArea(i: NatureItem): Footprint {
  const r = i.kind === 'tree' ? 0.3 * i.scale : i.kind === 'lamp' ? 0.15 : i.kind === 'bench' ? 0.8 : 0.5
  return { minX: i.x - r, maxX: i.x + r, minZ: i.z - r, maxZ: i.z + r }
}

function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inside = (x: number, z: number, f: Footprint, m = 0) =>
  x >= f.minX - m && x <= f.maxX + m && z >= f.minZ - m && z <= f.maxZ + m
/** 1 on the lake's edge, less inside, more outside; `grow` widens the lake by that many metres */
const lakeRatio = (x: number, z: number, grow = 0) => ((x - LAKE.x) / (LAKE.rx + grow)) ** 2 + ((z - LAKE.z) / (LAKE.rz + grow)) ** 2

export function placeNature(seed: number, doors: DoorSpot[]): NatureItem[] {
  const rand = random(seed)
  const houses = [...doors.map(d => footprint(d)), ...ALL_SCENERY.map(sceneryArea)]
  // The farm's pens and field and the districts' props: only their own fences stand there
  const farm = [...PENS, FIELD, ...ALL_PROPS.map(propArea)]
  const lots = EMPTY_LOTS.map(l => footprint(l))
  const toys: Footprint[] = [
    ...TRAMPOLINES.map(t => ({ minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius })),
    ...BLOCKS.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 })),
  ]
  const items: NatureItem[] = []

  /** May a `kind` stand at (x, z), `fromStreet` metres or more off the paving, `apart` from other solid things? */
  function free(kind: NatureKind, x: number, z: number, fromStreet: number, apart = 0): boolean {
    if (!inTown(x, z, 1.5) || hedgeDistance(x, z) < 1.5) return false
    if (streetDistance(x, z) < fromStreet) return false
    if (inside(x, z, JETTY, 0.6) || lakeRatio(x, z, 1.5) <= 1) return false
    // A lamp stands in the narrow strip between the paving and the houses; the rest keeps more room
    const lamp = kind === 'lamp'
    if (doors.some(d => Math.hypot(d.x - x, d.z - z) < DOOR_RADIUS + (lamp ? 1.05 : 1.2))) return false
    if (houses.some(h => inside(x, z, h, lamp ? 0.45 : 1))) return false
    if (toys.some(t => inside(x, z, t, 1.7))) return false
    if (farm.some(f => inside(x, z, f, 1))) return false
    if (kind !== 'lamp' && Math.hypot(x - CLEARING.x, z - CLEARING.z) <= CLEARING.radius + 0.5) return false
    if (kind !== 'flowers' && kind !== 'fence' && lots.some(l => inside(x, z, l, 0.7))) return false
    if (apart > 0 && items.some(i => SOLID_KINDS.has(i.kind) && Math.hypot(i.x - x, i.z - z) < apart)) return false
    return true
  }
  const put = (kind: NatureKind, x: number, z: number, rotY = 0, scale = 1, color = 0) =>
    items.push({ kind, x, z, rotY, scale, color })

  // Lamps along every paved street, on alternating sides, one every LAMP_EVERY metres
  for (const s of ALL_STREETS.filter(s => s.kind !== 'dirt')) {
    let side = 1
    for (let k = 1; k < s.points.length; k++) {
      const a = s.points[k - 1]
      const b = s.points[k]
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      const ux = (b.x - a.x) / length
      const uz = (b.z - a.z) / length
      for (let t = LAMP_EVERY / 2; t < length; t += LAMP_EVERY) {
        for (const s2 of [side, -side]) {
          const x = a.x + ux * t - uz * s2 * (s.width / 2 + LAMP_OFFSET)
          const z = a.z + uz * t + ux * s2 * (s.width / 2 + LAMP_OFFSET)
          if (free('lamp', x, z, LAMP_OFFSET - 0.2, 2)) {
            put('lamp', x, z)
            break
          }
        }
        side = -side
      }
    }
  }

  // Benches round the plaza, between the avenues, facing its middle; and two by the lake
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const x = PLAZA.x + Math.cos(a) * (PLAZA.radius + 1.3)
    const z = PLAZA.z + Math.sin(a) * (PLAZA.radius + 1.3)
    if (free('bench', x, z, 0.8, 2)) put('bench', x, z, Math.atan2(PLAZA.x - x, PLAZA.z - z))
  }
  for (const a of [0.15 * Math.PI, 0.6 * Math.PI, 1.2 * Math.PI, 1.7 * Math.PI]) {
    const x = LAKE.x + Math.cos(a) * (LAKE.rx + 2.6)
    const z = LAKE.z + Math.sin(a) * (LAKE.rz + 2.6)
    if (items.filter(i => i.kind === 'bench').length < 6 && free('bench', x, z, 1, 2)) put('bench', x, z, Math.atan2(LAKE.x - x, LAKE.z - z))
  }

  // Flower beds round the lake
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const x = LAKE.x + Math.cos(a) * (LAKE.rx + 2)
    const z = LAKE.z + Math.sin(a) * (LAKE.rz + 2)
    if (free('flowers', x, z, 0.5)) put('flowers', x, z, a, 1, BLOSSOMS[k % BLOSSOMS.length])
  }

  // Gardens on the empty lots: flowers inside, a low fence round the three sides away from the street
  for (const [n, lot] of EMPTY_LOTS.entries()) {
    const f = lots[n]
    for (const [u, v] of [[0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
      put('flowers', f.minX + (f.maxX - f.minX) * u, f.minZ + (f.maxZ - f.minZ) * v, 0, 1.3, BLOSSOMS[(n * 4 + u * 4 + v * 2) % BLOSSOMS.length | 0])
    }
    const side = lot.side ?? 'back'
    const edges: [number, number, number, number][] = [
      [f.minX, f.minZ, f.maxX, f.minZ], [f.maxX, f.minZ, f.maxX, f.maxZ], [f.maxX, f.maxZ, f.minX, f.maxZ], [f.minX, f.maxZ, f.minX, f.minZ],
    ]
    // The edge nearest the street stays open
    const open = { back: 2, front: 0, left: 1, right: 3 }[side]
    edges.forEach(([x0, z0, x1, z1], k) => {
      if (k === open) return
      put('fence', (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), Math.hypot(x1 - x0, z1 - z0), 0)
    })
  }

  // Trees: many on the hills, in the park and round the lake, a few elsewhere
  for (let k = 0; k < 900; k++) {
    const x = (rand() * 2 - 1) * (TOWN_HALF - 2)
    const z = (rand() * 2 - 1) * (TOWN_HALF - 2)
    const onHill = HILLS.some(h => Math.hypot(h.x - x, h.z - z) < h.radius)
    const park = x < -3 && z < -3 && streetDistance(x, z) > 6
    const byLake = lakeRatio(x, z, 8) <= 1
    const chance = onHill ? 0.55 : park ? 0.35 : byLake ? 0.3 : 0.06
    if (rand() > chance) continue
    if (!free('tree', x, z, 2, 3.2)) continue
    put('tree', x, z, rand() * Math.PI, 0.8 + rand() * 0.5, LEAVES[Math.floor(rand() * LEAVES.length)])
  }

  // Bushes by the houses and along the streets
  for (let k = 0; k < 500 && items.filter(i => i.kind === 'bush').length < 40; k++) {
    const x = (rand() * 2 - 1) * (TOWN_HALF - 2)
    const z = (rand() * 2 - 1) * (TOWN_HALF - 2)
    if (!free('bush', x, z, 1, 0) || items.some(i => Math.hypot(i.x - x, i.z - z) < 1.6)) continue
    put('bush', x, z, rand() * Math.PI, 0.7 + rand() * 0.6, LEAVES[Math.floor(rand() * LEAVES.length)])
  }

  // The districts', from a sequence of their own, so the old town's trees and bushes stay where they always were
  const rand2 = random(seed + 101)
  const [forest, farmland] = NATURE.areas

  // The pens, fenced all round
  for (const p of PENS) {
    const corners = [[p.minX, p.minZ], [p.maxX, p.minZ], [p.maxX, p.maxZ], [p.minX, p.maxZ]]
    corners.forEach(([x0, z0], k) => {
      const [x1, z1] = corners[(k + 1) % 4]
      put('fence', (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), Math.hypot(x1 - x0, z1 - z0), 0)
    })
  }

  // The forest: trees close together but for its path and its clearing; on the farm, a few
  for (let k = 0; k < 1200; k++) {
    const x = forest.minX + rand2() * (farmland.maxX - forest.minX)
    const z = forest.minZ + rand2() * (forest.maxZ - forest.minZ)
    const inForest = inside(x, z, forest)
    const chance = inForest ? 0.8 : inside(x, z, farmland) ? 0.05 : 0
    if (rand2() > chance) continue
    // In the forest a little back from the path, so the camera following her along it sees past the crowns
    if (!free('tree', x, z, 2.5, inForest ? 2.4 : 3.2)) continue
    put('tree', x, z, rand2() * Math.PI, 0.8 + rand2() * 0.5, LEAVES[Math.floor(rand2() * LEAVES.length)])
  }

  // Bushes at the forest's edge and about the farm
  const bushes = items.filter(i => i.kind === 'bush').length
  for (let k = 0; k < 600 && items.filter(i => i.kind === 'bush').length < bushes + 24; k++) {
    const x = forest.minX + rand2() * (farmland.maxX - forest.minX)
    const z = forest.minZ + rand2() * (forest.maxZ - forest.minZ)
    if (!free('bush', x, z, 1, 0) || items.some(i => Math.hypot(i.x - x, i.z - z) < 1.6)) continue
    put('bush', x, z, rand2() * Math.PI, 0.7 + rand2() * 0.6, LEAVES[Math.floor(rand2() * LEAVES.length)])
  }

  return items
}

/** One shape repeated: an InstancedMesh with each copy placed (and coloured, if `colorOf` is given) */
function instances(
  geometry: THREE.BufferGeometry, material: THREE.Material, items: NatureItem[],
  place: (i: NatureItem, m: THREE.Matrix4) => void, colorOf?: (i: NatureItem) => number, shadow = true,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length))
  mesh.count = items.length
  const m = new THREE.Matrix4()
  const color = new THREE.Color()
  items.forEach((item, k) => {
    place(item, m)
    mesh.setMatrixAt(k, m)
    if (colorOf) mesh.setColorAt(k, color.setHex(colorOf(item)))
  })
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  return mesh
}

const standard = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })

/** Draws the items (a few instanced meshes, whatever their number) and gives the solid ones a collider */
export function buildNature(R: Rapier, world: RAPIER.World, scene: THREE.Scene, items: NatureItem[]) {
  const of = (kind: NatureKind) => items.filter(i => i.kind === kind)
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const at = (i: NatureItem, m: THREE.Matrix4, dy: number, sx = 1, sy = 1, sz = 1, local = new THREE.Vector3()) => {
    q.setFromAxisAngle(up, i.rotY)
    const offset = local.clone().applyQuaternion(q)
    m.compose(new THREE.Vector3(i.x + offset.x, groundUnder(i) + dy + offset.y, i.z + offset.z), q, new THREE.Vector3(sx, sy, sz))
  }

  const trees = of('tree')
  scene.add(
    instances(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), standard(0x8a5a33), trees, (i, m) => at(i, m, 0.9 * i.scale, i.scale, 1.8 * i.scale, i.scale)),
    // A blocky crown: a big box with a smaller one on top
    instances(new THREE.BoxGeometry(1, 1, 1), standard(0xffffff), trees, (i, m) => at(i, m, 2.4 * i.scale, 2.2 * i.scale, 1.6 * i.scale, 2.2 * i.scale), i => i.color),
    instances(new THREE.BoxGeometry(1, 1, 1), standard(0xffffff), trees, (i, m) => at(i, m, 3.5 * i.scale, 1.4 * i.scale, 1 * i.scale, 1.4 * i.scale), i => i.color),
  )
  scene.add(instances(new THREE.BoxGeometry(1, 1, 1), standard(0xffffff), of('bush'), (i, m) => at(i, m, 0.35 * i.scale, 1.1 * i.scale, 0.7 * i.scale, 0.9 * i.scale), i => i.color))

  const flowers = of('flowers')
  scene.add(
    instances(new THREE.BoxGeometry(1, 0.25, 1), standard(0x5a9e3c), flowers, (i, m) => at(i, m, 0.12, 1.4 * i.scale, 1, 0.9 * i.scale), undefined, false),
    instances(new THREE.BoxGeometry(1, 0.18, 1), standard(0xffffff), flowers, (i, m) => at(i, m, 0.32, 1.2 * i.scale, 1, 0.7 * i.scale), i => i.color, false),
  )

  // Along its edge: turned by rotY, the box's long side (z) runs from corner to corner
  scene.add(instances(new THREE.BoxGeometry(0.08, 0.6, 1), standard(0xfff8ec), of('fence'), (i, m) => at(i, m, 0.3, 1, 1, i.scale), undefined, false))

  const lamps = of('lamp')
  scene.add(
    instances(new THREE.CylinderGeometry(0.07, 0.09, 3, 6), standard(0x3d4a5c), lamps, (i, m) => at(i, m, 1.5)),
    instances(new THREE.BoxGeometry(0.4, 0.4, 0.4), standard(0xfff1b8, { emissive: 0xffd36b, emissiveIntensity: 0.6 }), lamps, (i, m) => at(i, m, 3.15)),
  )

  const benches = of('bench')
  scene.add(
    instances(new THREE.BoxGeometry(1.6, 0.12, 0.5), standard(0xa0703f), benches, (i, m) => at(i, m, 0.45)),
    instances(new THREE.BoxGeometry(1.6, 0.45, 0.1), standard(0xa0703f), benches, (i, m) => at(i, m, 0.75, 1, 1, 1, new THREE.Vector3(0, 0, -0.22))),
  )

  for (const i of items) {
    if (!SOLID_KINDS.has(i.kind)) continue
    const y = groundUnder(i)
    if (i.kind === 'tree') {
      // A pillar far above the crown: nothing lands on a tree top, she slides off. The camera looks past trunks and
      // through crowns: a tree may cover her for a moment, which is calmer than a camera jumping at every tree
      world.createCollider(
        R.ColliderDesc.cylinder(PILLAR / 2, 0.25 * i.scale).setTranslation(i.x, y + PILLAR / 2, i.z).setCollisionGroups(UNSEEN_GROUPS),
      )
    }
    if (i.kind === 'lamp') {
      world.createCollider(R.ColliderDesc.cylinder(PILLAR / 2, 0.12).setTranslation(i.x, y + PILLAR / 2, i.z).setCollisionGroups(UNSEEN_GROUPS))
    }
    if (i.kind === 'bench') {
      const turn = new THREE.Quaternion().setFromAxisAngle(up, i.rotY)
      // The seat, solid down to the ground, and the backrest behind it
      world.createCollider(R.ColliderDesc.cuboid(0.8, SEAT / 2, 0.25).setTranslation(i.x, y + SEAT / 2, i.z).setRotation(turn))
      const back = new THREE.Vector3(0, 0, -0.22).applyQuaternion(turn)
      world.createCollider(
        R.ColliderDesc.cuboid(0.8, 0.225, 0.05).setTranslation(i.x + back.x, y + 0.75, i.z + back.z).setRotation(turn),
      )
    }
  }
}
