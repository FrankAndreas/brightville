/**
 * Blocky but detailed houses, built from boxes: walls on a plinth, windows with sills on every floor, a stepped
 * roof, and by chance a chimney, an awning, a balcony and flower boxes. Pure data: `world.ts` turns the parts into a
 * few merged meshes. A house faces +z, stands on y = 0 and is centred on x = z = 0; its front is at z = d / 2.
 */

export type PartKind =
  | 'walls' | 'plinth' | 'cornice' | 'roof' | 'window' | 'sill' | 'door' | 'chimney' | 'awning' | 'balcony'
  | 'railing' | 'flowers' | 'trim' | 'lintel' | 'step'

export interface Part {
  kind: PartKind
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: number
  rotY?: number
}

export interface HouseSpec {
  w: number
  d: number
  floors: 1 | 2 | 3
  wall: number
  roof: number
  seed: number
  /** A door building's house: its door frame and leaf come from world.ts, so the opening stays free */
  door: boolean
}

export const FLOOR_HEIGHT = 2.4
const BASE = 0.2
const GLASS = 0x9fd3f0
const WHITE = 0xfff8ec
const WOOD = 0x8a5a33
const FLOWERS = [0xff5d8f, 0xffb703, 0xb5179e, 0xff8c42]
/** The roof rises at most this share of the walls' height (world.ts's camera box for the roof reaches 1.6 ×) */
const ROOF_SHARE = 0.55
const OVERHANG = 0.2
/** A door building's door: frame 2.2 wide, 2.9 high (world.ts) */
const DOOR = { half: 1.1, top: 2.9 }

/** How high the walls of a house with this many floors are: 2 floors are 5 m, as the door buildings always were */
export function wallHeight(floors: number): number {
  return floors * FLOOR_HEIGHT + BASE
}

/** mulberry32: the same seed gives the same house */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A colour a little darker (k < 1) or lighter (k > 1) */
function shade(color: number, k: number): number {
  const c = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * k)))
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

export function houseParts(spec: HouseSpec): Part[] {
  const { w, d, floors, wall, roof, door } = spec
  const rand = random(spec.seed * 7919 + floors * 31 + Math.round(w * 10))
  const h = wallHeight(floors)
  const front = d / 2
  const parts: Part[] = []
  const add = (kind: PartKind, x: number, y: number, z: number, pw: number, ph: number, pd: number, color: number) =>
    parts.push({ kind, x, y, z, w: pw, h: ph, d: pd, color })

  add('walls', 0, h / 2, 0, w, h, d, wall)
  add('plinth', 0, 0.15, 0, w + 0.16, 0.3, d + 0.16, shade(wall, 0.7))
  add('cornice', 0, h - 0.1, 0, w + 0.24, 0.2, d + 0.24, WHITE)
  // Light corner posts, as on the row houses
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('trim', sx * (w / 2), h / 2, sz * (d / 2), 0.22, h, 0.22, WHITE)

  // Windows on the front, evenly spaced; the ground floor keeps the middle free for a door
  const count = Math.max(2, Math.floor((w - 1) / 1.6))
  const xs = Array.from({ length: count }, (_, i) => -w / 2 + (w / count) * (i + 0.5))
  const flowerFloor = rand() < 0.7 ? Math.min(floors - 1, 1) : -1
  for (let f = 0; f < floors; f++) {
    const y = BASE + f * FLOOR_HEIGHT + 1.35
    let row = xs
    if (f === 0) {
      // Keep the door's middle free; two windows either side of it
      row = xs.filter(x => Math.abs(x) - 0.45 > DOOR.half + 0.1)
      if (row.length < 2) row = [-(DOOR.half + 0.1 + (w / 2 - DOOR.half - 0.1) / 2), DOOR.half + 0.1 + (w / 2 - DOOR.half - 0.1) / 2]
    }
    for (const x of row) {
      const ww = Math.min(0.9, Math.max(0.5, (w / 2 - DOOR.half - 0.2) * 0.8))
      add('window', x, y, front + 0.04, f === 0 ? ww : 0.9, 1.1, 0.08, GLASS)
      add('sill', x, y - 0.62, front + 0.08, (f === 0 ? ww : 0.9) + 0.2, 0.1, 0.16, WHITE)
      add('lintel', x, y + 0.62, front + 0.06, (f === 0 ? ww : 0.9) + 0.14, 0.12, 0.12, WHITE)
      if (f === flowerFloor) add('flowers', x, y - 0.5, front + 0.12, 0.8, 0.18, 0.2, FLOWERS[Math.floor(rand() * FLOWERS.length)])
    }
    // One window on each side wall, per floor
    if (d >= 4) {
      for (const side of [-1, 1]) {
        parts.push({ kind: 'window', x: side * (w / 2 + 0.04), y, z: 0, w: 0.08, h: 1.1, d: 0.9, color: GLASS })
      }
    }
  }

  // A front door for a house that is just a house
  if (!door) {
    add('door', 0, BASE + 1.05, front + 0.05, 1.1, 2.1, 0.1, WOOD)
    add('step', 0, 0.08, front + 0.3, 1.5, 0.16, 0.5, shade(wall, 0.7))
  }

  // An awning over the ground floor (above the door building's frame), in the roof's colour
  if (rand() < 0.5) add('awning', 0, door ? DOOR.top + 0.12 : 2.45, front + 0.3, w * 0.7, 0.12, 0.6, roof)

  // A balcony on the second floor
  if (floors >= 2 && rand() < 0.5) {
    // Above a door building's door frame
    const y = DOOR.top + 0.12
    add('balcony', 0, y, front + 0.28, w * 0.45, 0.12, 0.56, WHITE)
    add('railing', 0, y + 0.3, front + 0.52, w * 0.45, 0.5, 0.06, WHITE)
  }

  // A stepped roof: gabled (narrowing front to back) or hipped (narrowing all round), never higher than ROOF_SHARE
  const hipped = rand() < 0.5
  const steps = 3
  const stepHeight = (h * ROOF_SHARE) / steps
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps
    const rw = hipped ? (w + 2 * OVERHANG) * (0.35 + 0.65 * k) : w + 2 * OVERHANG
    const rd = (d + 2 * OVERHANG) * (0.25 + 0.75 * k)
    add('roof', 0, h + stepHeight * (i + 0.5), 0, rw, stepHeight, rd, shade(roof, 1 - i * 0.08))
  }
  // A ridge along the top step
  const topWidth = hipped ? (w + 2 * OVERHANG) * (0.35 + 0.65 / steps) : w + 2 * OVERHANG
  add('roof', 0, h * (1 + ROOF_SHARE) - 0.04, 0, topWidth + 0.06, 0.08, 0.3, shade(roof, 0.7))

  // A chimney through the roof, its top still under the camera's box
  if (rand() < 0.6) {
    const top = h * (1 + ROOF_SHARE) + Math.min(0.3, h * (1.6 - 1 - ROOF_SHARE) - 0.01)
    const height = top - h
    add('chimney', w * 0.25 * (rand() < 0.5 ? -1 : 1), h + height / 2, -d * 0.15, 0.45, height, 0.45, shade(wall, 0.6))
  }

  return parts
}
