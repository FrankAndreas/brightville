import { randomLook, type Dress } from '@/core/look'
import { PLAZA } from './map'

/**
 * Townsfolk: anonymous wobblies strolling fixed loops along the streets. They never come towards her: one who meets
 * her turns back and strolls the other way. They have no body she bumps into, and their loops keep clear of the doors.
 */

export const WALK_SPEED = 1.2
/** She is in the way when she is this close ahead and this close to the line it walks */
const AHEAD = 2.2
const BESIDE = 1.4

type Point = { x: number; z: number }

const circle = (r: number, n: number): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: PLAZA.x + Math.cos((i / n) * Math.PI * 2) * r, z: PLAZA.z + Math.sin((i / n) * Math.PI * 2) * r }))

/**
 * Closed loops, on the middle of the streets (`map.ts`): from the last point back to the first. A loop of two points
 * is a walk down a street and back.
 */
export const ROUTES: Point[][] = [
  circle(5, 24),
  [{ x: -32, z: 0 }, { x: -32, z: 32 }, { x: 32, z: 32 }, { x: 32, z: -32 }, { x: 0, z: -32 }, { x: 0, z: -8 }, { x: -8, z: 0 }],
  [{ x: 0, z: 9 }, { x: 0, z: 54 }],
  [{ x: 9, z: 0 }, { x: 54, z: 0 }],
  [{ x: 0, z: -34 }, { x: 0, z: -54 }],
  [{ x: -34, z: 0 }, { x: -54, z: 0 }],
  [{ x: 32, z: 30 }, { x: 32, z: -30 }],
]

export interface Walker {
  route: number
  /** Metres along the loop from its first point */
  along: number
  /** 1 along the loop, -1 back */
  dir: 1 | -1
}

const lengths = ROUTES.map(points => points.reduce((sum, p, i) => {
  const next = points[(i + 1) % points.length]
  return sum + Math.hypot(next.x - p.x, next.z - p.z)
}, 0))

export function routeLength(route: number): number {
  return lengths[route]
}

/** Where a walker is and which way it faces (heading as the character's: atan2 of x and z) */
export function walkerAt(w: Walker): Point & { heading: number } {
  const points = ROUTES[w.route]
  const length = lengths[w.route]
  let left = ((w.along % length) + length) % length
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const piece = Math.hypot(b.x - a.x, b.z - a.z)
    if (left <= piece || i === points.length - 1) {
      const t = piece > 0 ? Math.min(1, left / piece) : 0
      const dx = (b.x - a.x) * w.dir
      const dz = (b.z - a.z) * w.dir
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(dx, dz) }
    }
    left -= piece
  }
  return { ...points[0], heading: 0 }
}

/** One step: on along the loop, or turned back when she stands in the way */
export function stepWalker(w: Walker, her: Point, dt: number): Walker {
  const p = walkerAt(w)
  const fx = Math.sin(p.heading)
  const fz = Math.cos(p.heading)
  const dx = her.x - p.x
  const dz = her.z - p.z
  const ahead = dx * fx + dz * fz
  const beside = Math.abs(dx * fz - dz * fx)
  const dir: 1 | -1 = ahead > 0 && ahead < AHEAD && beside < BESIDE ? (-w.dir as 1 | -1) : w.dir
  const length = lengths[w.route]
  return { route: w.route, dir, along: (((w.along + dir * WALK_SPEED * dt) % length) + length) % length }
}

/** One walker on each loop, spread out, half of them the other way round */
export function startWalkers(): Walker[] {
  return ROUTES.map((_, route) => ({ route, along: lengths[route] * ((route * 0.37) % 1), dir: route % 2 ? -1 : 1 }))
}

/** A random look, and nothing from the shops: what she buys or is given stays hers */
export function townsfolkDress(rand: () => number = Math.random): Dress {
  return { look: randomLook(rand), worn: {} }
}
