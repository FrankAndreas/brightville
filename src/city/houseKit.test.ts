import { describe, expect, it } from 'vitest'
import { FLOOR_HEIGHT, houseParts, wallHeight, type Part } from './houseKit'

const base = { w: 6, d: 5, floors: 2 as const, wall: 0xffc8dd, roof: 0xff8fab, seed: 1, door: false }
const overlaps = (p: Part, box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) =>
  p.x + p.w / 2 > box.minX && p.x - p.w / 2 < box.maxX &&
  p.y + p.h / 2 > box.minY && p.y - p.h / 2 < box.maxY &&
  p.z + p.d / 2 > box.minZ && p.z - p.d / 2 < box.maxZ

describe('houseParts', () => {
  it('puts at least two windows on every floor of the front', () => {
    for (const floors of [1, 2, 3] as const) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const parts = houseParts({ ...base, floors, seed })
        for (let f = 0; f < floors; f++) {
          const windows = parts.filter(p => p.kind === 'window' && p.z > base.d / 2 - 0.01 &&
            p.y > f * FLOOR_HEIGHT && p.y < (f + 1) * FLOOR_HEIGHT)
          expect(windows.length, `floors ${floors} seed ${seed} floor ${f}`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('leaves the door opening free when the house has a door building\'s door', () => {
    for (let seed = 0; seed < 30; seed++) {
      const parts = houseParts({ ...base, w: 8, seed, door: true })
      const opening = { minX: -1.1, maxX: 1.1, minY: 0.05, maxY: 2.9, minZ: base.d / 2 - 0.3, maxZ: base.d / 2 + 2 }
      const inTheWay = parts.filter(p => p.kind !== 'walls' && p.kind !== 'plinth' && overlaps(p, opening))
      expect(inTheWay, `seed ${seed}`).toEqual([])
    }
  })

  it('stays within its footprint plus 0.6 m of awnings and balconies, and under the camera\'s roof box', () => {
    for (const floors of [1, 2, 3] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const parts = houseParts({ ...base, floors, seed })
        const h = wallHeight(floors)
        for (const p of parts) {
          expect(Math.abs(p.x) + p.w / 2, `${p.kind}`).toBeLessThanOrEqual(base.w / 2 + 0.6)
          expect(Math.abs(p.z) + p.d / 2, `${p.kind}`).toBeLessThanOrEqual(base.d / 2 + 0.6)
          expect(p.y - p.h / 2, `${p.kind}`).toBeGreaterThanOrEqual(-0.01)
          // world.ts gives every roof a box up to 1.6 × the walls' height for the camera's ray
          expect(p.y + p.h / 2, `${p.kind}`).toBeLessThanOrEqual(h * 1.6 + 1e-9)
        }
      }
    }
  })

  it('is the same for the same seed and different for others', () => {
    expect(houseParts(base)).toEqual(houseParts(base))
    const looks = new Set(Array.from({ length: 12 }, (_, seed) => JSON.stringify(houseParts({ ...base, seed }).map(p => p.kind))))
    expect(looks.size).toBeGreaterThan(3)
    const kinds = new Set(Array.from({ length: 30 }, (_, seed) => houseParts({ ...base, seed })).flat().map(p => p.kind))
    for (const kind of ['chimney', 'awning', 'balcony', 'flowers'] as const) expect(kinds.has(kind), kind).toBe(true)
  })

  it('has between 20 and 120 parts', () => {
    for (const floors of [1, 2, 3] as const) {
      for (const w of [5, 6, 7, 8]) {
        const n = houseParts({ ...base, w, floors }).length
        expect(n).toBeGreaterThanOrEqual(20)
        expect(n).toBeLessThanOrEqual(120)
      }
    }
  })

  it('stands a door building as high as before, so the signs above the doors stay where they are', () => {
    expect(wallHeight(2)).toBeCloseTo(5)
  })
})
