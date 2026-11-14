import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint } from './doors'
import { EMPTY_LOTS, JETTY, LAKE, SCENERY_HOUSES, START, STREETS, inLake, onStreet, sceneryArea, solidAreas, streetDistance } from './map'
import { NATURE_SEED, SOLID_KINDS, natureArea, placeNature } from './nature'
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
})
