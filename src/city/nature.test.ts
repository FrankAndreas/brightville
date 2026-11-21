import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint } from './doors'
import {
  ALL_PROPS, DISTRICTS, EMPTY_LOTS, JETTY, LAKE, SCENERY_HOUSES, START, STREETS, TOWN_HALF, hedgeDistance, inLake, inTown, onStreet,
  propArea, sceneryArea, solidAreas, streetDistance,
} from './map'
import { CLEARING, FIELD, PENS } from './districts/nature'
import { NATURE_SEED, SOLID_KINDS, buildNature, natureArea, placeNature } from './nature'

// Drawing only: colliders go nowhere
const desc = new Proxy({}, { get: () => () => desc })
const RAPIER_STUB = { ColliderDesc: { cylinder: () => desc, cuboid: () => desc } } as unknown as typeof RAPIER
const WORLD_STUB = { createCollider: () => undefined } as unknown as RAPIER.World
import { BLOCKS, TRAMPOLINES } from './props'
import { reachableFrom } from './testing/reach'

const doors = BUILDINGS.map(b => b.door)
const items = placeNature(NATURE_SEED, doors)
const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
const inside = (p: { x: number; z: number }, f: { minX: number; maxX: number; minZ: number; maxZ: number }, m = 0) =>
  p.x >= f.minX - m && p.x <= f.maxX + m && p.z >= f.minZ - m && p.z <= f.maxZ + m

describe('placeNature', () => {
  it('places plenty of each kind', () => {
    for (const kind of ['tree', 'bush', 'flowers', 'fence', 'lamp', 'bench'] as const) {
      expect(items.filter(i => i.kind === kind).length, kind).toBeGreaterThanOrEqual(kind === 'tree' ? 30 : 4)
    }
  })

  it('places nothing on a street, the plaza, the jetty or in the lake and on its shore', () => {
    for (const i of items) {
      const where = `${i.kind} at ${i.x.toFixed(1)},${i.z.toFixed(1)}`
      expect(onStreet(i.x, i.z), where).toBe(false)
      expect(inside(i, JETTY, 0.5), where).toBe(false)
      expect(((i.x - LAKE.x) / (LAKE.rx + 1.5)) ** 2 + ((i.z - LAKE.z) / (LAKE.rz + 1.5)) ** 2, where).toBeGreaterThan(1)
    }
  })

  it(`keeps everything ${DOOR_RADIUS + 1} m from every door, and off every house, lot and toy`, () => {
    const houses = [...doors.map(d => footprint(d)), ...SCENERY_HOUSES.map(sceneryArea)]
    const toys = [
      ...TRAMPOLINES.map(t => ({ minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius })),
      ...BLOCKS.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 })),
    ]
    for (const i of items) {
      const where = `${i.kind} at ${i.x.toFixed(1)},${i.z.toFixed(1)}`
      for (const d of doors) expect(near(i, d), where).toBeGreaterThanOrEqual(DOOR_RADIUS + 1)
      for (const h of houses) expect(inside(i, h, 0.4), where).toBe(false)
      for (const t of toys) expect(inside(i, t, 1.5), where).toBe(false)
      // Gardens on the lots may have flowers and a fence, nothing that would stand in a future building's way
      if (i.kind !== 'flowers' && i.kind !== 'fence') for (const l of EMPTY_LOTS) expect(inside(i, footprint(l), 0.5), where).toBe(false)
    }
  })

  it('keeps every door and lot reachable with the trees, lamps and benches in the way', () => {
    const solids = [...solidAreas(doors), ...items.filter(i => SOLID_KINDS.has(i.kind)).map(natureArea)]
    const reachable = reachableFrom(START, solids)
    for (const [name, spot] of [...BUILDINGS.map(b => [b.id, b.door] as const), ...EMPTY_LOTS.map((l, i) => [`lot ${i}`, l] as const)]) {
      expect(reachable(spot.x, spot.z), name).toBe(true)
    }
  })

  it('lines the streets with lamps, about one every 12 to 18 m', () => {
    for (const [n, s] of STREETS.entries()) {
      let length = 0
      for (let k = 1; k < s.points.length; k++) length += near(s.points[k - 1], s.points[k])
      const lamps = items.filter(i => i.kind === 'lamp' && streetDistance(i.x, i.z, [s]) <= 1.5)
      expect(lamps.length, `street ${n}`).toBeGreaterThanOrEqual(Math.floor(length / 18))
    }
  })

  it('puts flower beds by the lake and in the gardens', () => {
    const byLake = items.filter(i => i.kind === 'flowers' && !inLake(i.x, i.z) &&
      ((i.x - LAKE.x) / (LAKE.rx + 5)) ** 2 + ((i.z - LAKE.z) / (LAKE.rz + 5)) ** 2 <= 1)
    expect(byLake.length).toBeGreaterThanOrEqual(6)
    for (const [k, lot] of EMPTY_LOTS.entries()) {
      expect(items.filter(i => i.kind === 'flowers' && inside(i, footprint(lot))).length, `lot ${k}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('is the same every time', () => {
    expect(placeNature(NATURE_SEED, doors)).toEqual(items)
  })

  it('draws each garden and pen fence along its edge, from corner to corner', () => {
    const scene = new THREE.Scene()
    buildNature(RAPIER_STUB, WORLD_STUB, scene, items)
    const fences = items.filter(i => i.kind === 'fence')
    let mesh: THREE.InstancedMesh | undefined
    scene.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count === fences.length && ((o as THREE.InstancedMesh).geometry as THREE.BoxGeometry).parameters?.height === 0.6) mesh = o as THREE.InstancedMesh })
    expect(mesh).toBeDefined()
    const lots = [...EMPTY_LOTS.map(l => footprint(l)), ...PENS]
    const m = new THREE.Matrix4()
    fences.forEach((_, k) => {
      mesh!.getMatrixAt(k, m)
      // The box's long side runs from one end of the fence to the other
      const size = (mesh!.geometry as THREE.BoxGeometry).parameters
      const long = size.width > size.depth ? new THREE.Vector3(0.5, 0, 0) : new THREE.Vector3(0, 0, 0.5)
      const a = long.clone().applyMatrix4(m)
      const b = long.clone().negate().applyMatrix4(m)
      const corner = (p: THREE.Vector3) => lots.some(f => [[f.minX, f.minZ], [f.maxX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.maxZ]]
        .some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.05))
      expect(corner(a) && corner(b), `fence ${k}: ${a.x.toFixed(1)},${a.z.toFixed(1)} – ${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBe(true)
    })
  })

  const inOldTown = (i: { x: number; z: number }) => Math.abs(i.x) <= TOWN_HALF && Math.abs(i.z) <= TOWN_HALF
  const districtTrees = items.filter(i => i.kind === 'tree' && !inOldTown(i))

  it('keeps everything 1.5 m inside the outline and off the hedge', () => {
    for (const i of items) {
      const where = `${i.kind} at ${i.x.toFixed(1)},${i.z.toFixed(1)}`
      expect(inTown(i.x, i.z, 1.5), where).toBe(true)
      expect(hedgeDistance(i.x, i.z), where).toBeGreaterThanOrEqual(1.5)
    }
  })

  it('fills the forest half of the nature district with trees', () => {
    expect(items.filter(i => i.kind === 'tree' && i.x < 0 && i.z < -62).length).toBeGreaterThanOrEqual(40)
  })

  it('fences at least two pens on the farm, all round', () => {
    expect(PENS.length).toBeGreaterThanOrEqual(2)
    for (const [n, p] of PENS.entries()) {
      expect(p.minX >= 0 && p.maxZ < -62, `pen ${n}`).toBe(true)
      const sides = [
        [(p.minX + p.maxX) / 2, p.minZ, p.maxX - p.minX], [(p.minX + p.maxX) / 2, p.maxZ, p.maxX - p.minX],
        [p.minX, (p.minZ + p.maxZ) / 2, p.maxZ - p.minZ], [p.maxX, (p.minZ + p.maxZ) / 2, p.maxZ - p.minZ],
      ]
      for (const [x, z, length] of sides) {
        const fence = items.find(i => i.kind === 'fence' && Math.hypot(i.x - x, i.z - z) < 0.01 && Math.abs(i.scale - length) < 0.01)
        expect(fence, `pen ${n} side at ${x},${z}`).toBeDefined()
      }
    }
  })

  it('keeps the districts\' trees off their streets, lots, pens, field, clearing and props', () => {
    expect(districtTrees.length).toBeGreaterThanOrEqual(40)
    const lots = DISTRICTS.flatMap(d => d.lots.map(l => footprint(l.spot)))
    const keep = [...lots, ...PENS, FIELD, ...ALL_PROPS.map(propArea)]
    for (const t of districtTrees) {
      const where = `tree at ${t.x.toFixed(1)},${t.z.toFixed(1)}`
      expect(onStreet(t.x, t.z), where).toBe(false)
      for (const f of keep) expect(inside(t, f, 0.5), where).toBe(false)
      expect(Math.hypot(t.x - CLEARING.x, t.z - CLEARING.z), where).toBeGreaterThan(CLEARING.radius)
    }
  })

  it('lights the districts\' paved streets, and leaves the dirt paths dark', () => {
    for (const d of DISTRICTS.filter(d => d.id !== 'town')) {
      for (const [n, s] of d.streets.entries()) {
        const lamps = items.filter(i => i.kind === 'lamp' && streetDistance(i.x, i.z, [s]) <= 1.5)
        if (s.kind === 'dirt') expect(lamps, `${d.id} street ${n}`).toHaveLength(0)
        else expect(lamps.length, `${d.id} street ${n}`).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
