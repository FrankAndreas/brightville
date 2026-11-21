import type { DoorSpot, Footprint } from './doors'
import { BOUNDS, JETTY, hedgeDistance, inLake, inTown, solidAreas } from './map'

export interface Point {
  x: number
  z: number
}

/** Where she can walk, on a grid over the whole town: the map checks use it, and so does a ride's first stretch */
export interface WalkGrid {
  /** The grid's spacing in metres */
  step: number
  /** Whether she can stand at (x, z): on the town's ground, out of the water and clear of every solid */
  free(x: number, z: number): boolean
  /** Which grid points she can walk to from `from`, stepping between free neighbours */
  reachable(from: Point): (x: number, z: number) => boolean
}

/** Her body is about 0.4 m round: walls and blocks are that much bigger for the walk */
const BODY = 0.4
/** She stays 1 m from the hedge: round the outline's edge, and between the old town and each district */
const EDGE = 1

/** The walking grid past the door buildings of `doors`, the scenery houses and the playground's blocks */
export function walkGrid(doors: DoorSpot[], step = 0.5): WalkGrid {
  return walkGridAround(solidAreas(doors), step)
}

/** The walking grid past any `solids` (the nature checks add the trees, lamps and benches) */
export function walkGridAround(solids: Footprint[], step = 0.5): WalkGrid {
  const solid = solids.map(f => ({ minX: f.minX - BODY, maxX: f.maxX + BODY, minZ: f.minZ - BODY, maxZ: f.maxZ + BODY }))
  const free = (x: number, z: number) => {
    if (!inTown(x, z, EDGE) || hedgeDistance(x, z) < EDGE) return false
    if (inLake(x, z) && !(x >= JETTY.minX && x <= JETTY.maxX && z >= JETTY.minZ && z <= JETTY.maxZ)) return false
    return !solid.some(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)
  }

  const ni = Math.round((BOUNDS.maxX - BOUNDS.minX) / step) + 1
  const nj = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / step) + 1
  const index = (x: number, z: number) => {
    const i = Math.round((x - BOUNDS.minX) / step)
    const j = Math.round((z - BOUNDS.minZ) / step)
    return i < 0 || j < 0 || i >= ni || j >= nj ? -1 : i * nj + j
  }
  // Which cells are free, worked out once for all the floods: 0 not yet known, 1 free, 2 not
  const known = new Uint8Array(ni * nj)
  const freeCell = (c: number) => {
    if (!known[c]) known[c] = free(BOUNDS.minX + Math.floor(c / nj) * step, BOUNDS.minZ + (c % nj) * step) ? 1 : 2
    return known[c] === 1
  }

  const reachable = (from: Point) => {
    const seen = new Uint8Array(ni * nj)
    const first = index(from.x, from.z)
    const queue = first < 0 ? [] : [first]
    if (first >= 0) seen[first] = 1
    while (queue.length) {
      const c = queue.pop()!
      const i = Math.floor(c / nj)
      const j = c % nj
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= ni || b >= nj) continue
        const next = a * nj + b
        if (seen[next] || !freeCell(next)) continue
        seen[next] = 1
        queue.push(next)
      }
    }
    return (x: number, z: number) => {
      const c = index(x, z)
      return c >= 0 && seen[c] === 1
    }
  }

  return { step, free, reachable }
}
