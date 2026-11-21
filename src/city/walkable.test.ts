import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { ALL_SCENERY, DISTRICTS, START, inTown, sceneryArea } from './map'
import { walkGrid } from './walkable'

const doors = BUILDINGS.map(b => b.door)
const grid = walkGrid(doors)
const reach = grid.reachable(START)

describe('the walking grid', () => {
  it('is 0.5 m fine by default', () => {
    expect(grid.step).toBe(0.5)
  })

  it('reaches every point of every street in every district from the start', () => {
    for (const d of DISTRICTS) {
      for (const [n, s] of d.streets.entries()) {
        for (let k = 1; k < s.points.length; k++) {
          const a = s.points[k - 1], b = s.points[k]
          const length = Math.hypot(b.x - a.x, b.z - a.z)
          for (let t = 0; t <= length; t += 0.5) {
            const x = a.x + ((b.x - a.x) * t) / length, z = a.z + ((b.z - a.z) * t) / length
            if (!inTown(x, z, 1)) continue // a street's end may reach the edge, where the hedge stands
            expect(reach(x, z), `${d.id} street ${n} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(true)
          }
        }
      }
    }
  })

  it('counts no point inside a house as free, in the old town or a district', () => {
    for (const h of ALL_SCENERY) {
      const f = sceneryArea(h)
      const x = (f.minX + f.maxX) / 2, z = (f.minZ + f.maxZ) / 2
      expect(grid.free(x, z), `house at ${x},${z}`).toBe(false)
      expect(reach(x, z), `house at ${x},${z}`).toBe(false)
    }
    expect(ALL_SCENERY.some(h => sceneryArea(h).maxZ < -60)).toBe(true)
  })

  it('keeps her out of the lake and off the far side of the hedge', () => {
    expect(grid.free(16, 17)).toBe(false)
    expect(grid.free(16, 8)).toBe(true) // the jetty
    expect(grid.free(-40, -62)).toBe(false)
    expect(grid.free(0, -62)).toBe(true)
  })
})
