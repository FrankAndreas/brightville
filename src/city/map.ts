import { BLOCKS } from './props'
import { footprint, type DoorSpot, type Footprint } from './doors'
import { NATURE } from './districts/nature'
import type { Area, District, DistrictProp, Stop } from './districts/types'
import { WORKSHOP } from './districts/workshop'

/**
 * The town as data: streets, hills, the lake, the gardens and the houses that are just houses, in the old square and
 * in the districts joined onto it (`districts/`). `world.ts` builds the town from it; `map.test.ts` checks it (every
 * door reachable, nothing steep, the lake closed) before anything is drawn. Door buildings are placed in
 * `src/buildings/registry.ts`, along these streets.
 *
 * Coordinates: metres, x to the right, z towards the camera's first view (the camera starts at +z looking at -z).
 */

/** Half the side of the old square town; the districts lie outside it */
export const TOWN_HALF = 60
export const PLAZA = { x: 0, z: 0, radius: 8 }
/** Where she starts, on the plaza */
export const START = { x: 0, z: 5 }
/** No slope she walks on is steeper (the character controller climbs 45°) */
export const MAX_SLOPE_DEG = 20

export interface Street {
  points: { x: number; z: number }[]
  width: number
  /** A dirt path or lane in the nature district, drawn in a dirt colour; a paved street when not given */
  kind?: 'dirt'
}

/**
 * Four avenues from the plaza, and a ring road joining them about 32 m out on three sides. The fourth quarter (back
 * left, -x -z) is a park with the big hill, open to the avenues.
 */
export const STREETS: Street[] = [
  { points: [{ x: 0, z: -PLAZA.radius }, { x: 0, z: -56 }], width: 6 },
  { points: [{ x: 0, z: PLAZA.radius }, { x: 0, z: 56 }], width: 6 },
  { points: [{ x: -PLAZA.radius, z: 0 }, { x: -56, z: 0 }], width: 6 },
  { points: [{ x: PLAZA.radius, z: 0 }, { x: 56, z: 0 }], width: 6 },
  { points: [{ x: -32, z: 0 }, { x: -32, z: 32 }, { x: 32, z: 32 }, { x: 32, z: -32 }, { x: 0, z: -32 }], width: 6 },
]

export interface Hill {
  x: number
  z: number
  radius: number
  height: number
}

/** A hill rises as a cosine bump: steepest halfway, at height · π / (2 · radius), so 3.2 / 15 is 18.5° */
export const HILLS: Hill[] = [
  { x: -26, z: -28, radius: 15, height: 3.2 },
  { x: -22, z: -50, radius: 7, height: 1.4 },
  { x: 48, z: -48, radius: 10, height: 2 },
  { x: 48, z: 46, radius: 10, height: 2 },
  { x: -46, z: 46, radius: 10, height: 2 },
  // Gentle bumps in the forest, off its path and its clearing
  { x: -22, z: -68, radius: 6, height: 1 },
  { x: -14, z: -99, radius: 5, height: 0.9 },
]

/** The lake, an ellipse in the front right quarter, by the plaza */
export const LAKE = { x: 16, z: 17, rx: 9.5, rz: 8 }

/** A wooden jetty from the avenue to the right into the lake */
export const JETTY: Footprint = { minX: 15, maxX: 17, minZ: 3, maxZ: 13 }

/** A house that is just a house: where its front meets the street (like a door spot), its size and its floors */
export interface SceneryHouse {
  spot: DoorSpot
  w: number
  d: number
  floors: 1 | 2 | 3
  /** Its own wall and roof colours (the farm's barn is red); a row-house pair by its place in the list when not given */
  look?: { wall: number; roof: number }
}

const scenery = (x: number, z: number, side: DoorSpot['side'], floors: 1 | 2 | 3, w = 6): SceneryHouse =>
  ({ spot: { x, z, side }, w, d: 5, floors })

export const SCENERY_HOUSES: SceneryHouse[] = [
  // (3.5, −24, right) is the Kalender now
  scenery(3.5, -51, 'right', 3),
  scenery(-3.5, -51, 'left', 2),
  scenery(-3.5, 51, 'left', 2),
  scenery(-24, -3.5, 'back', 2),
  scenery(-51, -3.5, 'back', 1),
  // (24, −3.5, back) is the Trommelhaus now
  scenery(51, 3.5, 'front', 2),
  scenery(-35.5, 16, 'left', 2),
  scenery(-35.5, 27, 'left', 1),
  scenery(-25.5, 28.5, 'back', 2),
  // (−16, 35.5, front) is the Spielwelt now
  scenery(-27, 35.5, 'front', 2),
  scenery(16, 35.5, 'front', 2),
  scenery(27, 35.5, 'front', 1),
  scenery(35.5, -27, 'right', 2),
  scenery(35.5, 16, 'right', 3),
  scenery(35.5, 27, 'right', 2),
  scenery(25, -28.5, 'front', 2),
  scenery(16, -35.5, 'back', 2),
  scenery(27, -35.5, 'back', 3),
]

/** The old town as a district: the square, its streets and houses, and the plaza as its stop */
const TOWN: District = {
  id: 'town',
  areas: [{ minX: -TOWN_HALF, maxX: TOWN_HALF, minZ: -TOWN_HALF, maxZ: TOWN_HALF, ground: 0xb8e6a3 }],
  streets: STREETS,
  scenery: SCENERY_HOUSES,
  // The playground's blocks and trampolines are in props.ts
  props: [],
  lots: [],
  // On the plaza's edge in front of her start, looking at the fountain in the middle
  stops: [{ id: 'platz', icon: '⛲', x: PLAZA.x, z: PLAZA.z + 7, face: Math.PI, line: 'Wir fahren zum Platz!' }],
}

export const DISTRICTS: District[] = [TOWN, NATURE, WORKSHOP]
/** The town's ground: every district's areas, which never overlap */
export const OUTLINE: Area[] = DISTRICTS.flatMap(d => d.areas)
export const BOUNDS: Footprint = {
  minX: Math.min(...OUTLINE.map(a => a.minX)),
  maxX: Math.max(...OUTLINE.map(a => a.maxX)),
  minZ: Math.min(...OUTLINE.map(a => a.minZ)),
  maxZ: Math.max(...OUTLINE.map(a => a.maxZ)),
}
export const ALL_STREETS: Street[] = DISTRICTS.flatMap(d => d.streets)
export const ALL_SCENERY: SceneryHouse[] = DISTRICTS.flatMap(d => d.scenery)
export const ALL_PROPS: DistrictProp[] = DISTRICTS.flatMap(d => d.props)
export const STOPS: Stop[] = DISTRICTS.flatMap(d => d.stops)

/**
 * Lots kept for buildings still to come, each a garden until then. The cat sleeps in the first and the dog lives in
 * the second (src/city/animals.ts), so those two stay first. The Reimhaus took the lot at (35.5, −16) and the
 * Musterwerkstatt the one at (3.5, 51); the rest are the districts' lots.
 */
export const EMPTY_LOTS: DoorSpot[] = [
  { x: -3.5, z: -40, side: 'left' },
  { x: -51, z: 3.5, side: 'front' },
  ...DISTRICTS.flatMap(d => d.lots.map(l => l.spot)),
]

/**
 * Inside the outline, at least `margin` m from its edge (a square of that half size around the point lies on the
 * town's ground). Where two areas meet is not an edge: the areas never overlap, so the square is on the ground when
 * the parts of it inside each area add up to all of it.
 */
export function inTown(x: number, z: number, margin = 0): boolean {
  if (margin <= 0) return OUTLINE.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)
  let covered = 0
  for (const a of OUTLINE) {
    const w = Math.min(x + margin, a.maxX) - Math.max(x - margin, a.minX)
    const d = Math.min(z + margin, a.maxZ) - Math.max(z - margin, a.minZ)
    if (w > 0 && d > 0) covered += w * d
  }
  return covered >= 4 * margin * margin - 1e-9
}

/** The ground a scenery house covers */
export function sceneryArea(h: SceneryHouse): Footprint {
  return footprint(h.spot, h.w, h.d)
}

/** The ground a district's prop covers */
export function propArea(p: DistrictProp): Footprint {
  return { minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 }
}

type Point = { x: number; z: number }

/** Which district (its place in DISTRICTS) holds the point, or −1 outside the town */
function districtAt(x: number, z: number): number {
  return DISTRICTS.findIndex(d => d.areas.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ))
}

/**
 * Where the hedge stands: round the outline, and between the old town and each district, but for the gates. Not
 * between two areas of one district (the forest and the farm). Straight pieces along x or z, each from `a` to `b`.
 */
function buildHedge(): { a: Point; b: Point }[] {
  // Each area's edges, cut where other areas' edges meet them, kept where the other side is outside the town or
  // another district (once for each pair of districts)
  const pieces: { alongX: boolean; at: number; from: number; to: number }[] = []
  DISTRICTS.forEach((d, di) => {
    for (const a of d.areas) {
      const edges = [
        { alongX: true, at: a.minZ, from: a.minX, to: a.maxX, out: -1 }, { alongX: true, at: a.maxZ, from: a.minX, to: a.maxX, out: 1 },
        { alongX: false, at: a.minX, from: a.minZ, to: a.maxZ, out: -1 }, { alongX: false, at: a.maxX, from: a.minZ, to: a.maxZ, out: 1 },
      ]
      for (const e of edges) {
        const cuts = OUTLINE.flatMap(o => (e.alongX ? [o.minX, o.maxX] : [o.minZ, o.maxZ])).filter(c => c > e.from && c < e.to)
        const stops = [...new Set([e.from, ...cuts, e.to])].sort((p, q) => p - q)
        for (let k = 1; k < stops.length; k++) {
          const mid = (stops[k - 1] + stops[k]) / 2
          const beyond = e.alongX ? districtAt(mid, e.at + e.out * 0.01) : districtAt(e.at + e.out * 0.01, mid)
          if (beyond === di || (beyond >= 0 && beyond < di)) continue
          pieces.push({ alongX: e.alongX, at: e.at, from: stops[k - 1], to: stops[k] })
        }
      }
    }
  })
  // Pieces on one line that touch become one
  pieces.sort((p, q) => Number(p.alongX) - Number(q.alongX) || p.at - q.at || p.from - q.from)
  const lines: typeof pieces = []
  for (const p of pieces) {
    const last = lines[lines.length - 1]
    if (last && last.alongX === p.alongX && last.at === p.at && last.to >= p.from) last.to = Math.max(last.to, p.to)
    else lines.push({ ...p })
  }
  // The gates' gaps
  for (const g of DISTRICTS.flatMap(d => (d.gate ? [d.gate] : []))) {
    for (const [k, l] of lines.entries()) {
      const [at, along] = l.alongX ? [g.z, g.x] : [g.x, g.z]
      if (l.at !== at || along <= l.from || along >= l.to) continue
      lines.splice(k, 1, { ...l, to: along - g.width / 2 }, { ...l, from: along + g.width / 2 })
      break
    }
  }
  return lines.filter(l => l.to > l.from).map(l => (l.alongX
    ? { a: { x: l.from, z: l.at }, b: { x: l.to, z: l.at } }
    : { a: { x: l.at, z: l.from }, b: { x: l.at, z: l.to } }))
}

const HEDGE = buildHedge()

/** The hedge's straight pieces (a copy each time) */
export function hedgeSegments(): { a: Point; b: Point }[] {
  return HEDGE.map(s => ({ a: { ...s.a }, b: { ...s.b } }))
}

/** How far (x, z) is from the hedge's middle line */
export function hedgeDistance(x: number, z: number): number {
  return Math.min(...HEDGE.map(s => segmentDistance(x, z, s.a, s.b)))
}

/** Ground height in metres: 0 everywhere but on the hills */
export function heightAt(x: number, z: number): number {
  let y = 0
  for (const h of HILLS) {
    const d = Math.hypot(x - h.x, z - h.z)
    if (d < h.radius) y += h.height * (0.5 + 0.5 * Math.cos((Math.PI * d) / h.radius))
  }
  return y
}

export function inLake(x: number, z: number): boolean {
  return ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2 <= 1
}

function segmentDistance(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz))
}

/** How far (x, z) is from the paving of the nearest street (0 on it); without `streets`, every district's and the plaza */
export function streetDistance(x: number, z: number, streets: Street[] = ALL_STREETS): number {
  let best = streets === ALL_STREETS ? Math.max(0, Math.hypot(x - PLAZA.x, z - PLAZA.z) - PLAZA.radius) : Infinity
  for (const s of streets) {
    for (let i = 1; i < s.points.length; i++) {
      best = Math.min(best, Math.max(0, segmentDistance(x, z, s.points[i - 1], s.points[i]) - s.width / 2))
    }
  }
  return best
}

/** On a street or the plaza */
export function onStreet(x: number, z: number): boolean {
  return streetDistance(x, z) === 0
}

/**
 * Everything she can't walk through: the door buildings (of `doors`), every scenery house, the districts' props and
 * the playground's blocks
 */
export function solidAreas(doors: DoorSpot[]): Footprint[] {
  return [
    ...doors.map(d => footprint(d)),
    ...ALL_SCENERY.map(sceneryArea),
    ...ALL_PROPS.map(propArea),
    ...BLOCKS.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 })),
  ]
}
