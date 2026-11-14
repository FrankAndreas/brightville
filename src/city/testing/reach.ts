import type { Footprint } from '../doors'
import { JETTY, TOWN_HALF, inLake } from '../map'

const STEP = 0.5

/**
 * For tests: which spots she can walk to from `start`, on a 0.5 m grid, past `solids` (made bigger by her body's
 * 0.4 m) and around the lake (the jetty is walkable). Returns a check for a spot.
 */
export function reachableFrom(start: { x: number; z: number }, solids: Footprint[]): (x: number, z: number) => boolean {
  const solid = solids.map(f => ({ minX: f.minX - 0.4, maxX: f.maxX + 0.4, minZ: f.minZ - 0.4, maxZ: f.maxZ + 0.4 }))
  const n = Math.round((2 * (TOWN_HALF - 1)) / STEP) + 1
  const at = (i: number) => -(TOWN_HALF - 1) + i * STEP
  const index = (v: number) => Math.round((v + TOWN_HALF - 1) / STEP)
  const free = (i: number, j: number) => {
    const x = at(i)
    const z = at(j)
    if (inLake(x, z) && !(x >= JETTY.minX && x <= JETTY.maxX && z >= JETTY.minZ && z <= JETTY.maxZ)) return false
    return !solid.some(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)
  }
  const seen = new Uint8Array(n * n)
  const queue = [index(start.x) * n + index(start.z)]
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
  return (x, z) => seen[index(x) * n + index(z)] === 1
}
