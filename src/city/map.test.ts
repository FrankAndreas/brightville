import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint, type Footprint } from './doors'
import { BLOCKS, TRAMPOLINES } from './props'
import {
  ALL_SCENERY, ALL_STREETS, BOUNDS, DISTRICTS, EMPTY_LOTS, HILLS, JETTY, LAKE, MAX_SLOPE_DEG, OUTLINE, PLAZA, SCENERY_HOUSES,
  START, STOPS, STREETS, heightAt, inLake, inTown, onStreet, sceneryArea, streetDistance, type Street,
} from './map'
import { walkGrid } from './walkable'

const STEP = 0.5
const gap = (a: Footprint, b: Footprint) => Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minZ - b.maxZ, b.minZ - a.maxZ)
const corners = (f: Footprint) => [[f.minX, f.minZ], [f.maxX, f.minZ], [f.minX, f.maxZ], [f.maxX, f.maxZ]] as const
const doors = BUILDINGS.map(b => b.door)
const houses: [string, Footprint][] = [
  ...BUILDINGS.map((b): [string, Footprint] => [b.id, footprint(b.door)]),
  ...EMPTY_LOTS.map((l, i): [string, Footprint] => [`lot ${i}`, footprint(l)]),
  ...ALL_SCENERY.map((h, i): [string, Footprint] => [`house ${i}`, sceneryArea(h)]),
]
const blocks: [string, Footprint][] = BLOCKS.map((b, i): [string, Footprint] =>
  [`${b.kind} ${i}`, { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }])
const pads: [string, Footprint][] = TRAMPOLINES.map((t, i): [string, Footprint] =>
  [`trampoline ${i}`, { minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius }])
const around = (x: number, z: number, r: number): Footprint => ({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r })

function* cells(f: Footprint) {
  for (let x = f.minX; x <= f.maxX + 1e-9; x += STEP) for (let z = f.minZ; z <= f.maxZ + 1e-9; z += STEP) yield [x, z] as const
}
/** Every grid point of the town, on the 0.5 m grid over its bounding box */
function* town() {
  for (const [x, z] of cells(BOUNDS)) if (inTown(x, z)) yield [x, z] as const
}

/** The old town's streets as they were before the districts, to check they never move */
const OLD_STREETS: Street[] = [
  { points: [{ x: 0, z: -8 }, { x: 0, z: -56 }], width: 6 },
  { points: [{ x: 0, z: 8 }, { x: 0, z: 56 }], width: 6 },
  { points: [{ x: -8, z: 0 }, { x: -56, z: 0 }], width: 6 },
  { points: [{ x: 8, z: 0 }, { x: 56, z: 0 }], width: 6 },
  { points: [{ x: -32, z: 0 }, { x: -32, z: 32 }, { x: 32, z: 32 }, { x: 32, z: -32 }, { x: 0, z: -32 }], width: 6 },
]
const districtLots = DISTRICTS.flatMap(d => d.lots)
const reach = walkGrid(doors).reachable(START)

describe('the town map', () => {
  it('keeps every house, lot and prop inside the town, 2 m from the edge', () => {
    for (const [name, f] of [...houses, ...blocks, ...pads]) for (const [x, z] of corners(f)) expect(inTown(x, z, 2), `${name} at ${x},${z}`).toBe(true)
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
    for (const [x, z] of town()) if (onStreet(x, z)) expect(heightAt(x, z), `street at ${x},${z}`).toBe(0)
  })

  it(`has no slope steeper than ${MAX_SLOPE_DEG}°`, () => {
    const limit = Math.tan((MAX_SLOPE_DEG * Math.PI) / 180)
    const h = 0.1
    let steepest = 0
    for (const [x, z] of town()) {
      const gx = (heightAt(x + h, z) - heightAt(x - h, z)) / (2 * h)
      const gz = (heightAt(x, z + h) - heightAt(x, z - h)) / (2 * h)
      steepest = Math.max(steepest, Math.hypot(gx, gz))
    }
    expect(steepest).toBeLessThanOrEqual(limit)
  })

  it('has at least one hill 3 m high or more', () => {
    expect(Math.max(...HILLS.map(h => heightAt(h.x, h.z)))).toBeGreaterThanOrEqual(3)
  })

  it('reaches every door and every empty lot from the start on foot', () => {
    for (const [name, spot] of [...BUILDINGS.map(b => [b.id, b.door] as const), ...EMPTY_LOTS.map((l, i) => [`lot ${i}`, l] as const)]) {
      expect(reach(spot.x, spot.z), name).toBe(true)
    }
  })

  it('keeps the lake closed: 3 m from every door, street, house and prop, but for the jetty', () => {
    const keep: [string, Footprint][] = [
      ...houses, ...blocks, ...pads, ...doors.map((d, i): [string, Footprint] => [`door ${BUILDINGS[i].id}`, around(d.x, d.z, 0)]),
    ]
    for (const [x, z] of town()) {
      if (!inLake(x, z)) continue
      const cell = around(x, z, 0)
      for (const [name, f] of keep) expect(gap(cell, f), `${name} at the lake (${x},${z})`).toBeGreaterThanOrEqual(3)
      expect(streetDistance(x, z), `street at the lake (${x},${z})`).toBeGreaterThanOrEqual(3)
    }
    expect(inLake(LAKE.x, LAKE.z)).toBe(true)
    // The jetty reaches from the street into the water
    expect(onStreet(JETTY.minX, JETTY.minZ - 0.5) || onStreet(JETTY.maxX, JETTY.minZ - 0.5) || onStreet(JETTY.minX, JETTY.maxZ + 0.5)).toBe(true)
    expect(inLake((JETTY.minX + JETTY.maxX) / 2, JETTY.maxZ - 0.5) || inLake((JETTY.minX + JETTY.maxX) / 2, JETTY.minZ + 0.5)).toBe(true)
  })

  it('mixes the buildings: no street has more than 3 learning buildings, and play and shops are spread out', () => {
    for (const [i, street] of ALL_STREETS.entries()) {
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
      for (const [x, z] of corners(pad)) expect(inTown(x, z, 8), `trampoline ${i} / edge`).toBe(true)
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        for (let r = 0; r <= t.radius + 8; r += STEP) expect(inLake(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r), `trampoline ${i} / lake`).toBe(false)
      }
      for (const [name, f] of houses) expect(gap(pad, f), `trampoline ${i} / ${name}`).toBeGreaterThanOrEqual(4)
      for (const d of doors) expect(gap(pad, around(d.x, d.z, 0)), `trampoline ${i} / door`).toBeGreaterThanOrEqual(4)
    }
  })

  it('faces every door and every empty lot onto a street', () => {
    for (const street of ALL_STREETS) expect(street.width).toBeGreaterThan(0)
    for (const [name, spot] of [...BUILDINGS.map(b => [b.id, b.door] as const), ...EMPTY_LOTS.map((l, i) => [`lot ${i}`, l] as const)]) {
      expect(streetDistance(spot.x, spot.z), name).toBeLessThanOrEqual(1)
    }
  })

  it('starts her on the plaza, and keeps the playground off the streets', () => {
    expect(Math.hypot(START.x - PLAZA.x, START.z - PLAZA.z)).toBeLessThan(PLAZA.radius)
    for (const [name, f] of [...blocks, ...pads]) for (const [x, z] of cells(f)) expect(onStreet(x, z), `${name} at ${x},${z}`).toBe(false)
  })

  it('joins the nature district behind and the workshop district to the right, each through a gate on its avenue', () => {
    const nature = DISTRICTS.find(d => d.id === 'nature')!, workshop = DISTRICTS.find(d => d.id === 'workshop')!
    expect(nature.areas.every(a => a.maxZ <= -60)).toBe(true)
    expect(workshop.areas.every(a => a.minX >= 60)).toBe(true)
    expect(onStreet(0, -60) && onStreet(0, -62)).toBe(true) // the back avenue goes through
    expect(onStreet(60, 0) && onStreet(62, 0)).toBe(true) // the right avenue goes through
    for (const d of [nature, workshop]) expect(onStreet(d.gate!.x, d.gate!.z), d.id).toBe(true)
  })

  it('makes the outline of areas that never overlap, inside its bounding box', () => {
    expect(OUTLINE).toEqual(DISTRICTS.flatMap(d => d.areas))
    for (const [i, a] of OUTLINE.entries()) {
      expect(a.minX >= BOUNDS.minX && a.maxX <= BOUNDS.maxX && a.minZ >= BOUNDS.minZ && a.maxZ <= BOUNDS.maxZ).toBe(true)
      for (const [j, b] of OUTLINE.entries()) if (i !== j) expect(gap(a, b), `area ${i} / ${j}`).toBeGreaterThanOrEqual(0)
    }
    // Margins count from the outline's edge, not from where two areas meet
    expect(inTown(0, -60, 2)).toBe(true)
    expect(inTown(60, 0, 2)).toBe(true)
    expect(inTown(-40, -60, 0)).toBe(true)
    expect(inTown(-40, -60, 0.5)).toBe(false)
    expect(inTown(-40, -61)).toBe(false)
    expect(inTown(61, 30)).toBe(false)
  })

  it('keeps the old town as it was', () => {
    expect(STREETS).toEqual(OLD_STREETS)
    expect(SCENERY_HOUSES.length).toBe(18)
    expect(EMPTY_LOTS.slice(0, 2)).toEqual([{ x: -3.5, z: -40, side: 'left' }, { x: -51, z: 3.5, side: 'front' }])
    expect(EMPTY_LOTS.slice(2)).toEqual(districtLots.map(l => l.spot))
  })

  it('has a lot for the NMG house within 20 m of the nature gate, one for the Bee-Bot house, and three spare', () => {
    const nmg = districtLots.filter(l => l.use === 'nmg'), beebot = districtLots.filter(l => l.use === 'beebot')
    expect(nmg).toHaveLength(1)
    expect(beebot).toHaveLength(1)
    expect(districtLots.filter(l => l.use === 'spare')).toHaveLength(3)
    expect(Math.hypot(nmg[0].spot.x - 0, nmg[0].spot.z + 60)).toBeLessThanOrEqual(20)
    expect(DISTRICTS.find(d => d.id === 'nature')!.lots).toContain(nmg[0])
    expect(DISTRICTS.find(d => d.id === 'workshop')!.lots).toContain(beebot[0])
  })

  it('has one stop in each district, on a street or the plaza, reachable on foot', () => {
    expect(STOPS.map(s => s.id).sort()).toEqual(['bauernhof', 'platz', 'wald', 'werkstatt'])
    expect(STOPS).toEqual(DISTRICTS.flatMap(d => d.stops))
    expect(DISTRICTS.map(d => d.stops.length)).toEqual([1, 2, 1])
    for (const s of STOPS) {
      expect(streetDistance(s.x, s.z), s.id).toBeLessThanOrEqual(1)
      expect(reach(s.x, s.z), s.id).toBe(true)
    }
    expect(Object.fromEntries(STOPS.map(s => [s.id, s.line]))).toEqual({
      platz: 'Wir fahren zum Platz!', bauernhof: 'Wir fahren zum Bauernhof!', wald: 'Wir fahren in den Wald!', werkstatt: 'Wir fahren zur Werkstatt!',
    })
  })

  it('keeps every stop clear of doors and of the lots still to be built on, so arriving there shows no door prompt', () => {
    for (const s of STOPS) {
      for (const d of [...doors, ...districtLots.map(l => l.spot)]) {
        expect(Math.hypot(s.x - d.x, s.z - d.z), s.id).toBeGreaterThan(DOOR_RADIUS + 1)
      }
    }
  })
})
