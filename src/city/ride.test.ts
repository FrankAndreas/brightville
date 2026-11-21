import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint, type DoorSpot, type Side } from './doors'
import { EMPTY_LOTS, JETTY, START, STOPS, inLake, onStreet } from './map'
import { TRAMPOLINES } from './props'
import { RIDE_SPEED, doorTarget, planRide, startRide, steer, type RideTarget } from './ride'
import { NATURE_SEED, SOLID_KINDS, natureArea, placeNature, rideGrid } from './nature'
import type { Point } from './walkable'

const doors = BUILDINGS.map(b => b.door)
// The grid the town rides by (city.ts)
const grid = rideGrid(doors)
const natureSolids = placeNature(NATURE_SEED, doors).filter(i => SOLID_KINDS.has(i.kind)).map(natureArea)
const inNatureSolid = (x: number, z: number) => natureSolids.some(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)
const DT = 1 / 60
const stop = (id: string): RideTarget => {
  const s = STOPS.find(t => t.id === id)!
  return { x: s.x, z: s.z, face: s.face }
}

/** Every point of the path, 0.5 m apart, with how far it is from the path's end */
function samples(path: Point[]): { x: number; z: number; left: number }[] {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.z - path[i].z))
  let left = lengths.reduce((a, b) => a + b, 0)
  const out: { x: number; z: number; left: number }[] = []
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = lengths[i - 1]
    for (let t = 0; t < length; t += 0.5) out.push({ x: a.x + ((b.x - a.x) * t) / length, z: a.z + ((b.z - a.z) * t) / length, left: left - t })
    left -= length
  }
  out.push({ ...path[path.length - 1], left: 0 })
  return out
}

const length = (path: Point[]) => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0)
const onTrampoline = (x: number, z: number) => TRAMPOLINES.some(t => Math.hypot(x - t.x, z - t.z) < t.radius + 0.4)

/** Rides the path at 60 fps, moving exactly as steered */
function ride(path: Point[]) {
  let state = startRide(path)
  const at = { ...path[0] }
  const speeds: number[] = []
  const trail: Point[] = []
  for (let frame = 0; frame < 60 * 120; frame++) {
    const r = steer(state, at, DT)
    state = r.state
    speeds.push(r.speed)
    if (r.arrived) return { speeds, trail, time: (frame + 1) * DT, at, arrived: true }
    at.x += r.dirX * r.speed * DT
    at.z += r.dirZ * r.speed * DT
    trail.push({ ...at })
  }
  return { speeds, trail, time: Infinity, at, arrived: false }
}

/** Where the first stretch ends: the first point of the path on a street */
const firstStreet = (path: Point[]) => path.findIndex(p => onStreet(p.x, p.z))

describe('a ride on the bicycle', () => {
  it('rides the streets from the plaza to the farm stop, never over grass', () => {
    const path = planRide(START, stop('bauernhof'), grid)!
    expect(path).not.toBeNull()
    for (const p of samples(path)) {
      expect(onStreet(p.x, p.z), `${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true)
      expect(onTrampoline(p.x, p.z)).toBe(false)
    }
  })

  it('rides the streets from the plaza to every door, lot and stop, never over grass, a house or a trampoline', () => {
    const targets: [string, RideTarget][] = [
      ...BUILDINGS.map((b): [string, RideTarget] => [b.id, doorTarget(b.door)]),
      ...EMPTY_LOTS.map((l, i): [string, RideTarget] => [`lot ${i}`, doorTarget(l)]),
      ...STOPS.map((s): [string, RideTarget] => [s.id, { x: s.x, z: s.z, face: s.face }]),
    ]
    for (const [name, to] of targets) {
      const path = planRide(START, to, grid)
      if (Math.hypot(to.x - START.x, to.z - START.z) <= DOOR_RADIUS) continue
      expect(path, name).not.toBeNull()
      expect(path![path!.length - 1], name).toEqual({ x: to.x, z: to.z })
      for (const p of samples(path!)) {
        const where = `${name} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`
        // The door spot itself is half a metre off the paving
        if (p.left > 1) expect(onStreet(p.x, p.z), where).toBe(true)
        expect(grid.free(p.x, p.z), where).toBe(true)
        expect(onTrampoline(p.x, p.z), where).toBe(false)
        expect(inNatureSolid(p.x, p.z), `${where}: a tree, lamp or bench`).toBe(false)
      }
    }
  })

  it('from the top of the hill, the playground platform, a garden lot, the jetty, beside the lake and among the trees: first stretch stays free and reaches a street', () => {
    const lot = footprint(EMPTY_LOTS[0])
    const starts: [string, Point][] = [
      ['hill top', { x: -26, z: -28 }],
      ['playground platform', { x: 16, z: -22 }],
      ['garden lot', { x: (lot.minX + lot.maxX) / 2, z: (lot.minZ + lot.maxZ) / 2 }],
      ['jetty', { x: (JETTY.minX + JETTY.maxX) / 2, z: 11 }],
      ['beside the lake', { x: 22, z: 10.6 }],
      ['beside the lake, far side', { x: 16, z: 25.6 }],
      ['behind the big trampoline', { x: -46, z: -29 }],
      ['against a house wall', { x: -4.3, z: -51 }],
      ['in the forest', { x: -21, z: -71 }],
      ['on the treed hill', { x: -29, z: -25 }],
    ]
    for (const [name, from] of starts) {
      const path = planRide(from, stop('bauernhof'), grid)!
      expect(path, name).not.toBeNull()
      expect(path[0], name).toEqual(from)
      const reached = firstStreet(path)
      expect(reached, `${name} reaches a street`).toBeGreaterThan(0)
      // Where she isn't free (on the platform, at a wall) the bike starts from the nearest free spot beside her
      const first = samples(path.slice(0, reached + 1))
      const skip = grid.free(from.x, from.z) ? 0 : 3.5
      for (const p of first.filter(q => first[0].left - q.left >= skip)) {
        const where = `${name} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`
        expect(grid.free(p.x, p.z), where).toBe(true)
        expect(inLake(p.x, p.z) && !(p.x >= JETTY.minX && p.x <= JETTY.maxX), where).toBe(false)
        expect(onTrampoline(p.x, p.z), where).toBe(false)
        expect(inNatureSolid(p.x, p.z), `${where}: a tree, lamp or bench`).toBe(false)
      }
      // Then the streets only
      for (const p of samples(path.slice(reached))) expect(onStreet(p.x, p.z), `${name} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true)
    }
  })

  it('takes the short way off the grass: the first stretch is not much longer than the straight line to the nearest street', () => {
    const from = { x: -26, z: -28 }
    const path = planRide(from, stop('bauernhof'), grid)!
    const points = samples(path)
    const reached = points.find(p => onStreet(p.x, p.z))!
    // The back avenue's paving is 23 m away across the park, the left avenue's 25 m
    expect(points[0].left - reached.left).toBeLessThan(24)
  })

  it('plans nothing when she is already at the door or the stop', () => {
    const d = BUILDINGS[0].door
    expect(planRide({ x: d.x + 1, z: d.z }, doorTarget(d), grid)).toBeNull()
    const farm = stop('bauernhof')
    expect(planRide({ x: farm.x - 2, z: farm.z + 1 }, farm, grid)).toBeNull()
    expect(planRide({ x: farm.x - 3, z: farm.z }, farm, grid)).not.toBeNull()
  })

  it('the longest ride (workshop far end to forest far end) is 200–260 m and takes 17–24 s when steered at 60 fps', () => {
    const path = planRide({ x: 95, z: 0 }, { x: -26, z: -97, face: 0 }, grid)!
    const metres = length(path)
    const r = ride(path)
    console.info(`longest ride: ${metres.toFixed(1)} m in ${r.time.toFixed(2)} s`)
    expect(metres).toBeGreaterThanOrEqual(200)
    expect(metres).toBeLessThanOrEqual(260)
    expect(r.arrived).toBe(true)
    expect(r.time).toBeGreaterThanOrEqual(17)
    expect(r.time).toBeLessThanOrEqual(24)
  })

  it('starts and stops gently and never passes 12 m/s', () => {
    expect(RIDE_SPEED).toBe(12)
    const path = planRide(START, stop('werkstatt'), grid)!
    const r = ride(path)
    expect(r.arrived).toBe(true)
    expect(Math.hypot(r.at.x - path[path.length - 1].x, r.at.z - path[path.length - 1].z)).toBeLessThanOrEqual(0.3)
    expect(Math.max(...r.speeds)).toBeLessThanOrEqual(12)
    expect(Math.max(...r.speeds)).toBeGreaterThan(11.5)
    // From standing; then at most 8 m/s² either way
    expect(r.speeds[0]).toBeLessThanOrEqual(8 * DT + 1e-9)
    const arriving = r.speeds.length - 1
    for (let k = 1; k < arriving; k++) expect(Math.abs(r.speeds[k] - r.speeds[k - 1]), `frame ${k}`).toBeLessThanOrEqual(8 * DT + 1e-9)
    // The bike is all but stopped when it arrives, and stands still then
    expect(r.speeds[arriving - 1]).toBeLessThanOrEqual(1)
    expect(r.speeds[arriving]).toBe(0)
  })

  it('slows in a right-angle corner to 12 · cos(45°), the brief\'s corner limit', () => {
    const path = [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 40 }]
    const r = ride(path)
    const corner = r.trail.flatMap((p, k) => (Math.hypot(p.x - 40, p.z) < 1.5 ? [r.speeds[k + 1]] : []))
    expect(corner.length).toBeGreaterThan(0)
    expect(Math.min(...corner)).toBeLessThanOrEqual(12 * Math.cos(Math.PI / 4) + 0.15)
    expect(Math.min(...corner)).toBeGreaterThan(7.5)
    // On the straights she is at full speed
    expect(Math.max(...r.speeds)).toBeCloseTo(12, 5)
  })

  it('slows to 4 m/s for a sharp turn back', () => {
    const r = ride([{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 25, z: 1 }, { x: 0, z: 1 }])
    const corner = r.trail.flatMap((p, k) => (Math.hypot(p.x - 30, p.z) < 1.5 ? [r.speeds[k + 1]] : []))
    // (a little over while the bike cuts the turn: it keeps to 4 m/s until it is past the corner by its look ahead)
    expect(Math.min(...corner)).toBeLessThanOrEqual(4.3)
  })

  it('faces the house on arrival: doorTarget of a right-side door faces +x', () => {
    // face is a heading as the character uses it: she looks along (sin face, cos face), so 0 is +z and π/2 is +x
    const expected: Record<Side, number> = { right: Math.PI / 2, left: -Math.PI / 2, front: 0, back: Math.PI }
    for (const side of ['right', 'left', 'front', 'back'] as Side[]) {
      const door: DoorSpot = { x: 10, z: -4, side }
      const t = doorTarget(door)
      expect(t.x).toBe(10)
      expect(t.z).toBe(-4)
      expect(Math.atan2(Math.sin(t.face - expected[side]), Math.cos(t.face - expected[side])), side).toBeCloseTo(0, 9)
      const f = footprint(door)
      const toHouse = { x: (f.minX + f.maxX) / 2 - door.x, z: (f.minZ + f.maxZ) / 2 - door.z }
      expect(Math.sin(t.face) * toHouse.x + Math.cos(t.face) * toHouse.z, side).toBeGreaterThan(0)
    }
    // A door without a side has its house at the back
    expect(doorTarget({ x: 0, z: 0 }).face).toBeCloseTo(Math.PI, 9)
  })
})
