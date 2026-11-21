import type { Footprint } from '../doors'
import type { Point } from '../walkable'
import { walkGridAround } from '../walkable'

/**
 * For tests: which spots she can walk to from `start`, on the 0.5 m walking grid, past `solids` (made bigger by her
 * body's 0.4 m) and around the lake (the jetty is walkable). Returns a check for a spot.
 */
export function reachableFrom(start: Point, solids: Footprint[]): (x: number, z: number) => boolean {
  return walkGridAround(solids).reachable(start)
}
