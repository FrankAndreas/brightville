import { BLOCKS } from './props'
import { footprint, type DoorSpot, type Footprint } from './doors'

/**
 * The town as data: streets, hills, the lake, the empty lots and the houses that are just houses. `world.ts` builds
 * the town from it; `map.test.ts` checks it (every door reachable, nothing steep, the lake closed) before anything is
 * drawn. Door buildings are placed in `src/buildings/registry.ts`, along these streets.
 *
 * Coordinates: metres, x to the right, z towards the camera's first view (the camera starts at +z looking at -z).
 */

/** Half the side of the square town */
export const TOWN_HALF = 60
export const PLAZA = { x: 0, z: 0, radius: 8 }
/** Where she starts, on the plaza */
export const START = { x: 0, z: 5 }
/** No slope she walks on is steeper (the character controller climbs 45°) */
export const MAX_SLOPE_DEG = 20

export interface Street {
  points: { x: number; z: number }[]
  width: number
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
]

/** The lake, an ellipse in the front right quarter, by the plaza */
export const LAKE = { x: 16, z: 17, rx: 9.5, rz: 8 }

/** A wooden jetty from the avenue to the right into the lake */
export const JETTY: Footprint = { minX: 15, maxX: 17, minZ: 3, maxZ: 13 }

/**
 * Gardens between the houses: the cat sleeps in the first and the dog lives in the second (src/city/animals.ts). The
 * Reimhaus took the lot at (35.5, −16) and the Musterwerkstatt the one at (3.5, 51); no lot is left for a building.
 */
export const EMPTY_LOTS: DoorSpot[] = [
  { x: -3.5, z: -40, side: 'left' },
  { x: -51, z: 3.5, side: 'front' },
]

/** A house that is just a house: where its front meets the street (like a door spot), its size and its floors */
export interface SceneryHouse {
  spot: DoorSpot
  w: number
  d: number
  floors: 1 | 2 | 3
}

const scenery = (x: number, z: number, side: DoorSpot['side'], floors: 1 | 2 | 3, w = 6): SceneryHouse =>
  ({ spot: { x, z, side }, w, d: 5, floors })

export const SCENERY_HOUSES: SceneryHouse[] = [
  scenery(3.5, -24, 'right', 2, 7),
  scenery(3.5, -51, 'right', 3),
  scenery(-3.5, -51, 'left', 2),
  scenery(-3.5, 51, 'left', 2),
  scenery(-24, -3.5, 'back', 2),
  scenery(-51, -3.5, 'back', 1),
  scenery(24, -3.5, 'back', 3),
  scenery(51, 3.5, 'front', 2),
  scenery(-35.5, 16, 'left', 2),
  scenery(-35.5, 27, 'left', 1),
  scenery(-25.5, 28.5, 'back', 2),
  scenery(-16, 35.5, 'front', 3),
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

/** The ground a scenery house covers */
export function sceneryArea(h: SceneryHouse): Footprint {
  return footprint(h.spot, h.w, h.d)
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

/** How far (x, z) is from the paving of the nearest street (0 on it); without `streets`, the plaza counts too */
export function streetDistance(x: number, z: number, streets: Street[] = STREETS): number {
  let best = streets === STREETS ? Math.max(0, Math.hypot(x - PLAZA.x, z - PLAZA.z) - PLAZA.radius) : Infinity
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

/** Everything she can't walk through: the door buildings (of `doors`), the scenery houses and the playground's blocks */
export function solidAreas(doors: DoorSpot[]): Footprint[] {
  return [
    ...doors.map(d => footprint(d)),
    ...SCENERY_HOUSES.map(sceneryArea),
    ...BLOCKS.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 })),
  ]
}
