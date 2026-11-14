import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { footprint, type Footprint } from './doors'
import { BLOCKS, TRAMPOLINES } from './props'
import {
  EMPTY_LOTS, HILLS, JETTY, LAKE, MAX_SLOPE_DEG, PLAZA, SCENERY_HOUSES, START, STREETS, TOWN_HALF,
  heightAt, inLake, onStreet, sceneryArea, solidAreas, streetDistance,
} from './map'

const STEP = 0.5
const gap = (a: Footprint, b: Footprint) => Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minZ - b.maxZ, b.minZ - a.maxZ)
const outside = (f: Footprint) => Math.max(-f.minX, f.maxX, -f.minZ, f.maxZ)
const doors = BUILDINGS.map(b => b.door)
const houses: [string, Footprint][] = [
  ...BUILDINGS.map((b): [string, Footprint] => [b.id, footprint(b.door)]),
  ...EMPTY_LOTS.map((l, i): [string, Footprint] => [`lot ${i}`, footprint(l)]),
  ...SCENERY_HOUSES.map((h, i): [string, Footprint] => [`house ${i}`, sceneryArea(h)]),
]
const blocks: [string, Footprint][] = BLOCKS.map((b, i): [string, Footprint] =>
  [`${b.kind} ${i}`, { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }])
const pads: [string, Footprint][] = TRAMPOLINES.map((t, i): [string, Footprint] =>
  [`trampoline ${i}`, { minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius }])
const around = (x: number, z: number, r: number): Footprint => ({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r })

function* cells(f: Footprint) {
  for (let x = f.minX; x <= f.maxX + 1e-9; x += STEP) for (let z = f.minZ; z <= f.maxZ + 1e-9; z += STEP) yield [x, z] as const
}

describe('the town map', () => {
  it('keeps every house, lot and prop inside the town, 2 m from the edge', () => {
    for (const [name, f] of [...houses, ...blocks, ...pads]) expect(outside(f), name).toBeLessThanOrEqual(TOWN_HALF - 2)
  })

  it('keeps houses, lots and the playground from overlapping, with 1 m between', () => {
    const all = [...houses, ...blocks.filter(([n]) => n.startsWith('hurdle')), ...pads]
    for (const [a, fa] of all) for (const [b, fb] of all) if (a !== b) expect(gap(fa, fb), `${a} / ${b}`).toBeGreaterThanOrEqual(1)
    // The steps and the platform touch each other, but nothing else
    const climb = blocks.filter(([n]) => !n.startsWith('hurdle'))
    for (const [a, fa] of climb) for (const [b, fb] of [...houses, ...pads]) expect(gap(fa, fb), `${a} / ${b}`).toBeGreaterThanOrEqual(1)
  })

  it('leaves room to walk up to every door: 3 m to any other house, 4 m to the playground', () => {
    for (const b of BUILDINGS) {
      const spot = around(b.door.x, b.door.z, 0)
      for (const [name, f] of houses) if (name !== b.id) expect(gap(spot, f), `${b.id} next to ${name}`).toBeGreaterThanOrEqual(3)
      for (const [name, f] of [...blocks, ...pads]) expect(gap(spot, f), `${b.id} next to ${name}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('is flat under every house, lot, prop, street, the plaza, the jetty and 3 m around each door', () => {
    const flat: [string, Footprint][] = [
      ...houses, ...blocks, ...pads, ['plaza', around(PLAZA.x, PLAZA.z, PLAZA.radius)], ['jetty', JETTY],
      ...doors.map((d, i): [string, Footprint] => [`door ${BUILDINGS[i].id}`, around(d.x, d.z, 3)]),
    ]
    for (const [name, f] of flat) for (const [x, z] of cells(f)) expect(heightAt(x, z), `${name} at ${x},${z}`).toBe(0)
    for (let x = -TOWN_HALF; x <= TOWN_HALF; x += STEP) {
      for (let z = -TOWN_HALF; z <= TOWN_HALF; z += STEP) if (onStreet(x, z)) expect(heightAt(x, z), `street at ${x},${z}`).toBe(0)
    }
  })

  it(`has no slope steeper than ${MAX_SLOPE_DEG}°`, () => {
    const limit = Math.tan((MAX_SLOPE_DEG * Math.PI) / 180)
    const h = 0.1
    let steepest = 0
    for (let x = -TOWN_HALF; x <= TOWN_HALF; x += STEP) {
      for (let z = -TOWN_HALF; z <= TOWN_HALF; z += STEP) {
        const gx = (heightAt(x + h, z) - heightAt(x - h, z)) / (2 * h)
        const gz = (heightAt(x, z + h) - heightAt(x, z - h)) / (2 * h)
        steepest = Math.max(steepest, Math.hypot(gx, gz))
      }
    }
    expect(steepest).toBeLessThanOrEqual(limit)
  })

  it('has at least one hill 3 m high or more', () => {
    expect(Math.max(...HILLS.map(h => heightAt(h.x, h.z)))).toBeGreaterThanOrEqual(3)
  })

  it('reaches every door and every empty lot from the start on foot', () => {
    // Her body is about 0.4 m round: walls and blocks are that much bigger for the walk
    const solid = solidAreas(doors).map(f => ({ minX: f.minX - 0.4, maxX: f.maxX + 0.4, minZ: f.minZ - 0.4, maxZ: f.maxZ + 0.4 }))
    const n = Math.round((2 * (TOWN_HALF - 1)) / STEP) + 1
    const at = (i: number) => -(TOWN_HALF - 1) + i * STEP
    const free = (i: number, j: number) => {
      const x = at(i)
      const z = at(j)
      if (inLake(x, z) && !(x >= JETTY.minX && x <= JETTY.maxX && z >= JETTY.minZ && z <= JETTY.maxZ)) return false
      return !solid.some(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)
    }
    const index = (v: number) => Math.round((v + TOWN_HALF - 1) / STEP)
    const seen = new Uint8Array(n * n)
    const queue = [index(START.x) * n + index(START.z)]
    seen[queue[0]] = 1
    while (queue.length) {
      const c = queue.pop()!
      const i = Math.floor(c / n)
      const j = c % n
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di
        const b = j + dj
        if (a < 0 || b < 0 || a >= n || b >= n || seen[a * n + b] || !free(a, b)) continue
        seen[a * n + b] = 1
        queue.push(a * n + b)
      }
    }
    for (const [name, spot] of [...BUILDINGS.map(b => [b.id, b.door] as const), ...EMPTY_LOTS.map((l, i) => [`lot ${i}`, l] as const)]) {
      expect(seen[index(spot.x) * n + index(spot.z)], name).toBe(1)
    }
  })

  it('keeps the lake closed: 3 m from every door, street, house and prop, but for the jetty', () => {
    const keep: [string, Footprint][] = [
      ...houses, ...blocks, ...pads, ...doors.map((d, i): [string, Footprint] => [`door ${BUILDINGS[i].id}`, around(d.x, d.z, 0)]),
    ]
    for (let x = -TOWN_HALF; x <= TOWN_HALF; x += STEP) {
      for (let z = -TOWN_HALF; z <= TOWN_HALF; z += STEP) {
        if (!inLake(x, z)) continue
        const cell = around(x, z, 0)
        for (const [name, f] of keep) expect(gap(cell, f), `${name} at the lake (${x},${z})`).toBeGreaterThanOrEqual(3)
        expect(streetDistance(x, z), `street at the lake (${x},${z})`).toBeGreaterThanOrEqual(3)
      }
    }
    expect(inLake(LAKE.x, LAKE.z)).toBe(true)
    // The jetty reaches from the street into the water
    expect(onStreet(JETTY.minX, JETTY.minZ - 0.5) || onStreet(JETTY.maxX, JETTY.minZ - 0.5) || onStreet(JETTY.minX, JETTY.maxZ + 0.5)).toBe(true)
    expect(inLake((JETTY.minX + JETTY.maxX) / 2, JETTY.maxZ - 0.5) || inLake((JETTY.minX + JETTY.maxX) / 2, JETTY.minZ + 0.5)).toBe(true)
  })

  it('mixes the buildings: no street has more than 3 learning buildings, and play and shops are spread out', () => {
    for (const [i, street] of STREETS.entries()) {
      const learning = BUILDINGS.filter(b => b.kind === 'earn' && streetDistance(b.door.x, b.door.z, [street]) <= 1)
      expect(learning.length, `street ${i}: ${learning.map(b => b.id).join(', ')}`).toBeLessThanOrEqual(3)
    }
    const playAndShops = BUILDINGS.filter(b => b.kind === 'play' || b.kind === 'shop')
    const widest = Math.max(...playAndShops.flatMap(a => playAndShops.map(b => Math.hypot(a.door.x - b.door.x, a.door.z - b.door.z))))
    expect(widest).toBeGreaterThan(25)
  })

  it('puts Mein Haus within 20 m of the start', () => {
    const haus = BUILDINGS.find(b => b.id === 'haus')!
    expect(Math.hypot(haus.door.x - START.x, haus.door.z - START.z)).toBeLessThanOrEqual(20)
  })

  it('keeps every trampoline 8 m from the lake and the edge, 4 m from every house and door', () => {
    for (const [i, t] of TRAMPOLINES.entries()) {
      const pad = pads[i][1]
      expect(TOWN_HALF - outside(pad), `trampoline ${i} / edge`).toBeGreaterThanOrEqual(8)
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        for (let r = 0; r <= t.radius + 8; r += STEP) expect(inLake(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r), `trampoline ${i} / lake`).toBe(false)
      }
      for (const [name, f] of houses) expect(gap(pad, f), `trampoline ${i} / ${name}`).toBeGreaterThanOrEqual(4)
      for (const d of doors) expect(gap(pad, around(d.x, d.z, 0)), `trampoline ${i} / door`).toBeGreaterThanOrEqual(4)
    }
  })

  it('faces every door and every empty lot onto a street', () => {
    for (const street of STREETS) expect(street.width).toBeGreaterThan(0)
    for (const [name, spot] of [...BUILDINGS.map(b => [b.id, b.door] as const), ...EMPTY_LOTS.map((l, i) => [`lot ${i}`, l] as const)]) {
      expect(streetDistance(spot.x, spot.z), name).toBeLessThanOrEqual(1)
    }
  })

  it('starts her on the plaza, and keeps the playground off the streets', () => {
    expect(Math.hypot(START.x - PLAZA.x, START.z - PLAZA.z)).toBeLessThan(PLAZA.radius)
    for (const [name, f] of [...blocks, ...pads]) for (const [x, z] of cells(f)) expect(onStreet(x, z), `${name} at ${x},${z}`).toBe(false)
  })
})
