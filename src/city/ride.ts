import type { DoorSpot } from './doors'
import { DOOR_RADIUS, footprint } from './doors'
import { ALL_STREETS, BOUNDS, PLAZA, onStreet } from './map'
import { TRAMPOLINES } from './props'
import type { Point, WalkGrid } from './walkable'

/**
 * The bicycle's ride, as plain numbers: where it goes (`planRide`) and how fast and which way it is steered each frame
 * (`steer`). Nothing here draws or moves anything.
 *
 * The route: off the grass by the shortest free way to the nearest street (the first stretch), then along the streets
 * and district paths only, to the street in front of the door, and to the door. It never crosses grass after the first
 * stretch, nor the playground or the trampolines.
 */

/** Top speed on a straight, metres per second: about three times walking speed */
export const RIDE_SPEED = 12
/** How quickly the bike speeds up and slows down, m/s² */
const ACCELERATION = 8
/** The braking the speed limits plan with: a little under ACCELERATION, so the bike can keep to them frame by frame */
const PLANNED_BRAKING = 7.5
/** The slowest a corner is taken */
const CORNER_SPEED = 4
/** Within this of the end, the ride has arrived */
const ARRIVED = 0.3
/** The bike never crawls slower than this before it arrives */
const CREEP = 0.5
/** She keeps this far from a trampoline's rim on the first stretch: her body's 0.4 m */
const TRAMPOLINE_MARGIN = 0.4
/** She is steered at the point this far ahead on the path: the distance covered in 0.2 s, but at least 0.8 m */
const LOOK_AHEAD_TIME = 0.2
const LOOK_AHEAD_MIN = 0.8
/** How far round her the first stretch looks for a free spot to start from, when she isn't on one */
const START_SEARCH = 6

/** Where a ride ends: a door spot facing its house, or a stop facing its landmark */
export interface RideTarget {
  x: number
  z: number
  /**
   * The heading she faces on arrival, as `CharacterFrame.heading` and `Stop.face`: she looks along
   * (sin face, cos face), so 0 is towards +z (the camera) and π/2 towards +x
   */
  face: number
}

/**
 * The door spot, facing the house: face = atan2(dx, dz) for the way (dx, dz) from the spot to the house, so a house on
 * the right (+x) gives π/2, on the left −π/2, at the front (+z) 0 and at the back (−z, the default) π
 */
export function doorTarget(door: DoorSpot): RideTarget {
  const f = footprint(door)
  return { x: door.x, z: door.z, face: Math.atan2((f.minX + f.maxX) / 2 - door.x, (f.minZ + f.maxZ) / 2 - door.z) }
}

// ---------------------------------------------------------------------------------------------------------------------
// The street graph: nodes at every street point, every crossing of two streets and the plaza's rim, built once

interface Piece {
  a: number
  b: number
}

interface StreetGraph {
  nodes: Point[]
  /** Straight stretches of street between two nodes, with nothing in between */
  pieces: Piece[]
  /** For each node: where it leads and how far */
  links: { to: number; w: number }[][]
  /** The nodes on the plaza's rim */
  rim: number[]
}

const EPS = 1e-6
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

/** Where p lands on the segment a–b (t from 0 to 1) and the point there */
function project(p: Point, a: Point, b: Point): { t: number; at: Point } {
  const dx = b.x - a.x, dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)))
  return { t, at: { x: a.x + t * dx, z: a.z + t * dz } }
}

/** Where the segments a–b and c–d cross, inside both, or null */
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z
  const den = rx * sz - rz * sx
  if (Math.abs(den) < EPS) return null
  const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den
  const u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null
  return { x: a.x + t * rx, z: a.z + t * rz }
}

let graph: StreetGraph | null = null

function streetGraph(): StreetGraph {
  if (graph) return graph
  const segments = ALL_STREETS.flatMap(s => s.points.slice(1).map((b, i) => ({ a: s.points[i], b })))
  const nodes: Point[] = []
  const node = (p: Point) => {
    const found = nodes.findIndex(n => dist(n, p) < 1e-4)
    if (found >= 0) return found
    nodes.push({ x: p.x, z: p.z })
    return nodes.length - 1
  }
  for (const s of segments) {
    node(s.a)
    node(s.b)
  }
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const p = crossing(segments[i].a, segments[i].b, segments[j].a, segments[j].b)
      if (p) node(p)
    }
  }
  // Each segment cut at the nodes on it
  const pieces: Piece[] = []
  for (const s of segments) {
    const on = nodes
      .map((n, k) => ({ k, ...project(n, s.a, s.b), d: 0 }))
      .map(o => ({ ...o, d: dist(o.at, nodes[o.k]) }))
      .filter(o => o.d < 1e-4)
      .sort((p, q) => p.t - q.t)
    for (let k = 1; k < on.length; k++) if (on[k].k !== on[k - 1].k) pieces.push({ a: on[k - 1].k, b: on[k].k })
  }
  const links: { to: number; w: number }[][] = nodes.map(() => [])
  const join = (a: number, b: number) => {
    if (a === b || links[a].some(l => l.to === b)) return
    const w = dist(nodes[a], nodes[b])
    links[a].push({ to: b, w })
    links[b].push({ to: a, w })
  }
  for (const p of pieces) join(p.a, p.b)
  // The plaza is paved all over: across it, from any point of its rim straight to any other
  const rim = nodes.flatMap((n, k) => (Math.abs(dist(n, PLAZA) - PLAZA.radius) < 1e-4 ? [k] : []))
  for (const a of rim) for (const b of rim) join(a, b)
  graph = { nodes, pieces, links, rim }
  return graph
}

/** How a point off the graph joins it: to which nodes, how far, and through which point on the street's middle line */
interface Joint {
  node: number
  cost: number
  via: Point | null
}

function joints(p: Point, g: StreetGraph): { joints: Joint[]; piece: number; via: Point; onPlaza: boolean } {
  let best = -1, bestD = Infinity, via: Point = p
  g.pieces.forEach((piece, k) => {
    const { at } = project(p, g.nodes[piece.a], g.nodes[piece.b])
    const d = dist(p, at)
    if (d < bestD - EPS) {
      best = k
      bestD = d
      via = at
    }
  })
  const piece = g.pieces[best]
  const out: Joint[] = [piece.a, piece.b].map(n => ({ node: n, cost: bestD + dist(via, g.nodes[n]), via }))
  const onPlaza = dist(p, PLAZA) <= PLAZA.radius
  if (onPlaza) for (const n of g.rim) out.push({ node: n, cost: dist(p, g.nodes[n]), via: null })
  return { joints: out, piece: best, via, onPlaza }
}

/** The shortest way along the streets from `a` (on or by a street) to `b` */
function alongStreets(a: Point, b: Point): Point[] {
  const g = streetGraph()
  const start = joints(a, g)
  const end = joints(b, g)
  // Straight there when both are on one piece of street, or both on the plaza
  let direct = Infinity, directPath: Point[] = []
  if (start.onPlaza && end.onPlaza) {
    direct = dist(a, b)
    directPath = [a, b]
  } else if (start.piece === end.piece) {
    direct = dist(a, start.via) + dist(start.via, end.via) + dist(end.via, b)
    directPath = [a, start.via, end.via, b]
  }

  // Dijkstra over a few dozen nodes: the simple way is quick enough
  const n = g.nodes.length
  const best = new Array<number>(n).fill(Infinity)
  const from = new Array<number>(n).fill(-1)
  const entry = new Array<Joint | null>(n).fill(null)
  for (const j of start.joints) {
    if (j.cost < best[j.node]) {
      best[j.node] = j.cost
      entry[j.node] = j
    }
  }
  const done = new Uint8Array(n)
  for (;;) {
    let u = -1
    for (let k = 0; k < n; k++) if (!done[k] && best[k] < Infinity && (u < 0 || best[k] < best[u])) u = k
    if (u < 0) break
    done[u] = 1
    for (const l of g.links[u]) {
      if (best[u] + l.w < best[l.to]) {
        best[l.to] = best[u] + l.w
        from[l.to] = u
        entry[l.to] = null
      }
    }
  }
  let last: Joint | null = null, total = Infinity
  for (const j of end.joints) {
    if (best[j.node] + j.cost < total) {
      total = best[j.node] + j.cost
      last = j
    }
  }
  if (!last || direct <= total) return directPath

  const chain: number[] = []
  for (let k = last.node; k >= 0; k = from[k]) chain.unshift(k)
  const first = entry[chain[0]]
  return [
    a,
    ...(first?.via ? [first.via] : []),
    ...chain.map(k => g.nodes[k]),
    ...(last.via ? [last.via] : []),
    b,
  ]
}

// ---------------------------------------------------------------------------------------------------------------------
// The first stretch: over the walking grid to the nearest street

const nearTrampoline = (x: number, z: number) => TRAMPOLINES.some(t => Math.hypot(x - t.x, z - t.z) < t.radius + TRAMPOLINE_MARGIN)

/** Each grid's cells, worked out once as they are needed: 0 not yet known, 1 open for the bike, 2 not */
const cellCache = new WeakMap<WalkGrid, Uint8Array>()

function cells(grid: WalkGrid) {
  const step = grid.step
  const ni = Math.round((BOUNDS.maxX - BOUNDS.minX) / step) + 1
  const nj = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / step) + 1
  let known = cellCache.get(grid)
  if (!known) {
    known = new Uint8Array(ni * nj)
    cellCache.set(grid, known)
  }
  const cache = known
  const x = (c: number) => BOUNDS.minX + Math.floor(c / nj) * step
  const z = (c: number) => BOUNDS.minZ + (c % nj) * step
  const open = (c: number) => {
    if (!cache[c]) cache[c] = grid.free(x(c), z(c)) && !nearTrampoline(x(c), z(c)) ? 1 : 2
    return cache[c] === 1
  }
  const index = (i: number, j: number) => (i < 0 || j < 0 || i >= ni || j >= nj ? -1 : i * nj + j)
  return { step, ni, nj, x, z, open, index }
}

/** The bike can go straight from a to b: every 0.1 m of the way is free, and off the trampolines */
function clear(a: Point, b: Point, grid: WalkGrid): boolean {
  const n = Math.ceil(dist(a, b) / 0.1)
  for (let k = 0; k <= n; k++) {
    const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n
    if (!grid.free(x, z) || nearTrampoline(x, z)) return false
  }
  return true
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const

/** A small binary heap of grid cells, the nearest first */
class Heap {
  private keys: number[] = []
  private costs: number[] = []
  get size() {
    return this.keys.length
  }
  push(k: number, d: number) {
    const { keys, costs } = this
    let i = keys.length
    keys.push(k)
    costs.push(d)
    while (i > 0) {
      const up = (i - 1) >> 1
      if (costs[up] <= d) break
      keys[i] = keys[up]
      costs[i] = costs[up]
      i = up
    }
    keys[i] = k
    costs[i] = d
  }
  pop(): { k: number; d: number } {
    const { keys, costs } = this
    const top = { k: keys[0], d: costs[0] }
    const k = keys.pop()!, d = costs.pop()!
    if (keys.length) {
      let i = 0
      for (;;) {
        let child = 2 * i + 1
        if (child >= keys.length) break
        if (child + 1 < keys.length && costs[child + 1] < costs[child]) child++
        if (costs[child] >= d) break
        keys[i] = keys[child]
        costs[i] = costs[child]
        i = child
      }
      keys[i] = k
      costs[i] = d
    }
    return top
  }
}

/**
 * From `from` to the nearest street over open ground: a search outward over the grid, nearest first (diagonal steps
 * only where both straight neighbours are open too), then shortened by skipping corners where the straight line stays free. Her own
 * spot may not be free (on the playground's platform, right at a wall): the search then starts from the nearest open
 * cell around her. The way back is `from` first and a point on a street last; null when no street can be reached.
 */
function firstStretch(from: Point, grid: WalkGrid): Point[] | null {
  const startsFree = grid.free(from.x, from.z) && !nearTrampoline(from.x, from.z)
  if (startsFree && onStreet(from.x, from.z)) return [from]
  const c = cells(grid)
  const fi = (from.x - BOUNDS.minX) / c.step, fj = (from.z - BOUNDS.minZ) / c.step

  // The nearest open cell to her
  let start = -1, startD = Infinity
  const r = Math.ceil(START_SEARCH / c.step)
  for (let i = Math.floor(fi) - r; i <= Math.ceil(fi) + r; i++) {
    for (let j = Math.floor(fj) - r; j <= Math.ceil(fj) + r; j++) {
      const k = c.index(i, j)
      if (k < 0) continue
      const d = Math.hypot(i - fi, j - fj)
      if (d < startD && d * c.step <= START_SEARCH && c.open(k)) {
        start = k
        startD = d
      }
    }
  }
  if (start < 0) return null

  // Breadth-first by distance (a straight step 1, a diagonal √2), so the nearest street is the nearest on the ground
  const back = new Int32Array(c.ni * c.nj).fill(-1)
  const cost = new Float64Array(c.ni * c.nj).fill(Infinity)
  back[start] = start
  cost[start] = 0
  const queue = new Heap()
  queue.push(start, 0)
  let goal = -1
  while (queue.size) {
    const { k, d } = queue.pop()
    if (d > cost[k]) continue
    if (onStreet(c.x(k), c.z(k))) {
      goal = k
      break
    }
    const i = Math.floor(k / c.nj), j = k % c.nj
    for (const [di, dj] of NEIGHBOURS) {
      const next = c.index(i + di, j + dj)
      if (next < 0 || !c.open(next)) continue
      if (di && dj && !(c.open(c.index(i + di, j)) && c.open(c.index(i, j + dj)))) continue
      const nd = d + (di && dj ? Math.SQRT2 : 1)
      if (nd >= cost[next]) continue
      cost[next] = nd
      back[next] = k
      queue.push(next, nd)
    }
  }
  if (goal < 0) return null

  const steps: Point[] = []
  for (let k = goal; ; k = back[k]) {
    steps.unshift({ x: c.x(k), z: c.z(k) })
    if (k === start) break
  }
  // Skip corners while the straight line stays free; from her own spot when it is free, else from the open cell
  if (startsFree) steps[0] = { x: from.x, z: from.z }
  const out: Point[] = [steps[0]]
  let anchor = steps[0]
  for (let k = 1; k < steps.length - 1; k++) {
    if (!clear(anchor, steps[k + 1], grid)) {
      anchor = steps[k]
      out.push(anchor)
    }
  }
  if (steps.length > 1) out.push(steps[steps.length - 1])
  return startsFree ? out : [from, ...out]
}

/** Drops points on top of the one before, and points in the middle of a straight line */
function tidy(path: Point[]): Point[] {
  const out: Point[] = []
  for (const p of path) {
    if (out.length && dist(out[out.length - 1], p) < 0.01) continue
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1]
      const cross = (b.x - a.x) * (p.z - b.z) - (b.z - a.z) * (p.x - b.x)
      const dot = (b.x - a.x) * (p.x - b.x) + (b.z - a.z) * (p.z - b.z)
      if (Math.abs(cross) < 1e-6 * dist(a, b) * dist(b, p) && dot > 0) out.pop()
    }
    out.push(p)
  }
  return out
}

/**
 * The way from `from` to `to`: the first stretch to the nearest street, then the streets, then the door. Null when she
 * is already there (within DOOR_RADIUS), or (never in this town: the map checks see to it) when no street can be reached.
 */
export function planRide(from: Point, to: RideTarget, grid: WalkGrid): Point[] | null {
  if (dist(from, to) <= DOOR_RADIUS) return null
  const first = firstStretch(from, grid)
  if (!first) return null
  const onto = first[first.length - 1]
  const streets = alongStreets(onto, { x: to.x, z: to.z })
  return tidy([...first, ...streets.slice(1)])
}

// ---------------------------------------------------------------------------------------------------------------------
// Steering

export interface RideState {
  path: Point[]
  /** How far along the path she has come, metres */
  along: number
  /** The bike's speed, m/s */
  speed: number
}

export function startRide(path: Point[]): RideState {
  return { path, along: 0, speed: 0 }
}

/** How far along the path each of its points is */
function distances(path: Point[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + dist(path[i - 1], path[i]))
  return out
}

/** The point `d` metres along the path */
function pointAt(path: Point[], cum: number[], d: number): Point {
  if (d >= cum[cum.length - 1]) return path[path.length - 1]
  let i = 1
  while (cum[i] < d) i++
  const length = cum[i] - cum[i - 1]
  const t = length > 0 ? (d - cum[i - 1]) / length : 0
  return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, z: path[i - 1].z + (path[i].z - path[i - 1].z) * t }
}

/** The fastest a corner of the path is taken: max(4, 12 · cos(θ/2)) for a turn of θ (0 straight on, π back) */
function cornerSpeed(a: Point, b: Point, c: Point): number {
  const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z
  const cos = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz))
  const turn = Math.acos(Math.max(-1, Math.min(1, cos)))
  return Math.max(CORNER_SPEED, RIDE_SPEED * Math.cos(turn / 2))
}

/**
 * One frame of the ride: where she is now (`at`) moves her along the path; she is steered at a point a little ahead
 * on it, at a speed that rises and falls by at most 8 m/s², is never over 12 m/s, slows before corners and comes to a
 * stop at the end. Arrived within 0.3 m of the end (the speed is 0 then).
 */
export function steer(s: RideState, at: Point, dt: number): { state: RideState; dirX: number; dirZ: number; speed: number; arrived: boolean } {
  const { path } = s
  const cum = distances(path)
  const total = cum[cum.length - 1]
  const end = path[path.length - 1]

  // How far along she is: her place on the path near where she was, never back
  let along = s.along
  let bestD = Infinity
  for (let i = 1; i < path.length; i++) {
    if (cum[i] < s.along - 0.5 || cum[i - 1] > s.along + 6) continue
    const { t, at: p } = project(at, path[i - 1], path[i])
    const d = dist(at, p)
    if (d < bestD) {
      bestD = d
      along = Math.max(s.along, cum[i - 1] + t * (cum[i] - cum[i - 1]))
    }
  }

  if (dist(at, end) <= ARRIVED && total - along <= 1) {
    return { state: { path, along: total, speed: 0 }, dirX: 0, dirZ: 0, speed: 0, arrived: true }
  }

  // The speed allowed here: a stop at the end, and each corner ahead, can still be met braking gently
  const braking = (limit: number, ahead: number) => Math.sqrt(limit * limit + 2 * PLANNED_BRAKING * Math.max(0, ahead))
  let allowed = Math.min(RIDE_SPEED, braking(0, total - along - ARRIVED))
  // A corner counts until she is past it by the distance she looks ahead, so the whole curve is taken slowly
  const look = Math.max(LOOK_AHEAD_MIN, s.speed * LOOK_AHEAD_TIME)
  for (let i = 1; i < path.length - 1; i++) {
    if (cum[i] < along - look) continue
    allowed = Math.min(allowed, braking(cornerSpeed(path[i - 1], path[i], path[i + 1]), cum[i] - along))
  }
  allowed = Math.max(allowed, CREEP)
  const step = ACCELERATION * dt
  const speed = Math.min(RIDE_SPEED, Math.max(s.speed - step, Math.min(s.speed + step, allowed)))

  // Steered at a point a little ahead, so corners are taken in a small curve
  const ahead = pointAt(path, cum, along + Math.max(LOOK_AHEAD_MIN, speed * LOOK_AHEAD_TIME))
  let dx = ahead.x - at.x, dz = ahead.z - at.z
  let len = Math.hypot(dx, dz)
  if (len < 1e-6) {
    dx = end.x - at.x
    dz = end.z - at.z
    len = Math.hypot(dx, dz) || 1
  }
  return { state: { path, along, speed }, dirX: dx / len, dirZ: dz / len, speed, arrived: false }
}
