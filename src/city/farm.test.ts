import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { CLEARING, PENS } from './districts/nature'
import { NATURE_SEED, placeNature } from './nature'
import {
  DEER_HOMES, startDeer, startPenAnimals, stepDeer, stepPenAnimal, wantsMoo, type Deer, type PenAnimal,
} from './farm'

const inside = (p: { x: number; z: number }, pen: typeof PENS[number]) =>
  p.x >= pen.minX && p.x <= pen.maxX && p.z >= pen.minZ && p.z <= pen.maxZ
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
const pen = PENS[1]
const mid = { x: (pen.minX + pen.maxX) / 2, z: (pen.minZ + pen.maxZ) / 2 }
const chickenAt = (x: number, z: number): PenAnimal => ({ kind: 'chicken', x, z, heading: 0, homeX: x, homeZ: z, t: 0 })

describe('the pen animals', () => {
  it('starts every animal inside its pen', () => {
    const stock = startPenAnimals()
    expect(stock.length).toBeGreaterThanOrEqual(6)
    for (const { a, pen: p } of stock) expect(inside(a, p), `${a.kind} at ${a.x},${a.z}`).toBe(true)
  })

  it('moves a chicken 2 m from her away from her, inside its pen, in a second', () => {
    let c = chickenAt(mid.x, mid.z)
    const her = { x: mid.x - 2, z: mid.z }
    for (let t = 0; t < 1; t += 1 / 30) c = stepPenAnimal(c, her, 1 / 30, pen)
    expect(dist(c, her)).toBeGreaterThan(2.3)
    expect(inside(c, pen)).toBe(true)
  })

  it('never lets a chicken out of its pen or more than 2 m from home, however she chases it', () => {
    let c = chickenAt(pen.maxX - 0.8, pen.maxZ - 0.8)
    for (let t = 0; t < 10; t += 1 / 30) {
      c = stepPenAnimal(c, { x: c.x - 1, z: c.z - 1 }, 1 / 30, pen)
      expect(inside(c, pen)).toBe(true)
      expect(dist(c, { x: c.homeX, z: c.homeZ })).toBeLessThanOrEqual(2 + 1e-9)
    }
  })

  it('brings a chicken home after she has been 5 m away for 2 s', () => {
    let c = chickenAt(mid.x, mid.z)
    for (let t = 0; t < 1; t += 1 / 30) c = stepPenAnimal(c, { x: mid.x - 2, z: mid.z }, 1 / 30, pen)
    const far = { x: mid.x - 12, z: mid.z }
    for (let t = 0; t < 1.5; t += 1 / 30) c = stepPenAnimal(c, far, 1 / 30, pen)
    expect(dist(c, { x: c.homeX, z: c.homeZ })).toBeGreaterThan(0.5)
    for (let t = 0; t < 6; t += 1 / 30) c = stepPenAnimal(c, far, 1 / 30, pen)
    expect(dist(c, { x: c.homeX, z: c.homeZ })).toBeLessThan(0.05)
  })

  it('turns a cow\'s head towards her within 6 m', () => {
    const cow: PenAnimal = { kind: 'cow', x: mid.x, z: mid.z, heading: 0, homeX: mid.x, homeZ: mid.z, t: 0 }
    let c = cow
    for (let t = 0; t < 3; t += 1 / 30) c = stepPenAnimal(c, { x: mid.x + 4, z: mid.z }, 1 / 30, pen)
    expect(Math.abs(c.heading - Math.PI / 2)).toBeLessThan(0.1)
    expect(dist(c, cow)).toBeLessThan(1e-9)
  })

  it('moos when she comes within 6 m, and not again within 8 s', () => {
    const cow: PenAnimal = { kind: 'cow', x: 0, z: 0, heading: 0, homeX: 0, homeZ: 0, t: 0 }
    expect(wantsMoo(cow, { x: 7, z: 0 }, 100)).toBe(false)
    expect(wantsMoo(cow, { x: 5, z: 0 }, 100)).toBe(true)
    const mooed = { ...cow, mooAt: 100 }
    expect(wantsMoo(mooed, { x: 5, z: 0 }, 107.9)).toBe(false)
    expect(wantsMoo(mooed, { x: 5, z: 0 }, 108)).toBe(true)
    expect(wantsMoo(chickenAt(0, 0), { x: 1, z: 0 }, 100)).toBe(false)
  })
})

describe('the deer', () => {
  const home = DEER_HOMES[0]
  const grazing = (): Deer => ({ x: home.x, z: home.z, heading: 0, state: 'graze', t: 0 })
  const run = (d: Deer, her: { x: number; z: number }, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 30) d = stepDeer(d, her, 1 / 30)
    return d
  }

  it('grazes at the clearing\'s edge', () => {
    for (const d of startDeer()) {
      expect(dist(d, CLEARING)).toBeGreaterThanOrEqual(CLEARING.radius - 1)
      expect(dist(d, CLEARING)).toBeLessThanOrEqual(CLEARING.radius + 1.5)
    }
  })

  it('walks into the trees, not off in the open clearing, whichever side she comes from', () => {
    const trees = placeNature(NATURE_SEED, BUILDINGS.map(b => b.door)).filter(i => i.kind === 'tree')
    for (const home of DEER_HOMES) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        const her = { x: home.x + Math.cos(a) * 7.9, z: home.z + Math.sin(a) * 7.9 }
        const d = run({ x: home.x, z: home.z, heading: 0, state: 'graze', t: 0 }, her, 6)
        expect(d.state).toBe('gone')
        expect(dist(d, CLEARING), `from ${k}`).toBeGreaterThan(CLEARING.radius + 2)
        expect(trees.some(t => dist(d, t) < 4), `trees near ${d.x},${d.z}`).toBe(true)
      }
    }
  })

  it('stays when she is 9 m away and leaves when she comes within 8 m', () => {
    expect(run(grazing(), { x: home.x + 9, z: home.z }, 2).state).toBe('graze')
    const leaving = run(grazing(), { x: home.x + 7.9, z: home.z }, 0.5)
    expect(leaving.state).toBe('leave')
    expect(dist(leaving, { x: home.x + 7.9, z: home.z })).toBeGreaterThan(7.9)
  })

  it('is gone into the trees, stays gone while she is near, and is back after she has been 15 m away for 5 s', () => {
    const near = { x: home.x + 7.9, z: home.z }
    let d = run(grazing(), near, 8)
    expect(d.state).toBe('gone')
    d = run(d, { x: home.x + 11, z: home.z }, 20)
    expect(d.state).toBe('gone')
    d = run(d, { x: home.x + 15, z: home.z }, 4.5)
    expect(d.state).toBe('gone')
    d = run(d, { x: home.x + 15, z: home.z }, 1)
    expect(d.state).toBe('graze')
    expect(dist(d, home)).toBeLessThan(1e-9)
  })
})
