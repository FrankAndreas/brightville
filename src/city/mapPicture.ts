import type { DoorState } from '@/core/access'
import { footprint, type DoorSpot, type Footprint } from './doors'
import type { Area, DistrictId, StopId } from './districts/types'
import { ALL_STREETS, BOUNDS, DISTRICTS, HILLS, LAKE, PLAZA, STOPS, type Hill, type Street } from './map'

/**
 * The town from above for the map (`components/TownMap.vue`), drawn from the map data so it stays true as the town
 * grows: in the town's own metres, x to the right and −z up (the mountains' band along the top), as an SVG viewBox.
 */

type Point = { x: number; z: number }

/** Something on the map she can tap to ride to: a door building, or a district's stop */
export interface MapMarker {
  kind: 'building' | 'stop'
  id: string
  icon: string
  /** Its German name, for the button's label */
  name: string
  /** Where the ride goes: the door spot, or the stop */
  x: number
  z: number
  state: DoorState | 'stop'
  /** Stars a play building costs, shown on it when she hasn't enough */
  cost?: number
  /**
   * Where its picture is drawn: the middle of the house, or the landmark a stop looks at, moved apart from its
   * neighbours until every picture is MIN_PIN_GAP from the next (two doors across a street are only 7 m apart)
   */
  pin: Point
}

export interface MapPicture {
  viewBox: string
  /** The viewBox as a rectangle */
  box: Footprint
  /** Each district's ground, area by area in the area's own colour (the forest green, the farm yellow-brown) */
  districts: { id: DistrictId; areas: Area[] }[]
  streets: Street[]
  plaza: typeof PLAZA
  hills: Hill[]
  lake: typeof LAKE
  /** The band along the top where the mountains are drawn, behind the town */
  mountains: Footprint
  markers: MapMarker[]
}

/** A marker is drawn this wide, in metres: 45 px on a 1024 × 768 screen, where the whole map is 3.9 px a metre */
export const MARKER_SIZE = 11.5
/** No two pictures closer than this, middle to middle: a little gap between them, so a small finger finds the right one */
export const MIN_PIN_GAP = MARKER_SIZE + 1.5
/** The mountains' band above the town's back edge, and the margin round it all */
const BAND = 14
const MARGIN = 3
/** A stop's picture sits this far ahead of where she stops, on the landmark she looks at */
const LANDMARK_AHEAD = 7

const STOP_NAMES: Record<StopId, string> = { platz: 'Platz', bauernhof: 'Bauernhof', wald: 'Wald', werkstatt: 'Werkstatt' }

/** Pushes pictures that are too close apart, a little at a time, and keeps them inside `inside` */
function spread(pins: Point[], inside: Footprint): void {
  const clamp = (p: Point) => {
    p.x = Math.min(inside.maxX, Math.max(inside.minX, p.x))
    p.z = Math.min(inside.maxZ, Math.max(inside.minZ, p.z))
  }
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i], b = pins[j]
        let dx = b.x - a.x, dz = b.z - a.z
        let d = Math.hypot(dx, dz)
        if (d >= MIN_PIN_GAP) continue
        if (d < 1e-9) { dx = 1; dz = 0; d = 1 }
        // A hair more than needed, so it settles
        const push = (MIN_PIN_GAP - d) / 2 + 1e-3
        a.x -= (dx / d) * push; a.z -= (dz / d) * push
        b.x += (dx / d) * push; b.z += (dz / d) * push
        clamp(a)
        clamp(b)
        moved = true
      }
    }
    if (!moved) return
  }
}

/** The map of the town with these buildings on it; those this device can never go into are left out */
export function mapPicture(
  buildings: { id: string; icon: string; name: string; door: DoorSpot; state: DoorState; cost?: number }[],
): MapPicture {
  const box: Footprint = {
    minX: BOUNDS.minX - MARGIN, maxX: BOUNDS.maxX + MARGIN, minZ: BOUNDS.minZ - BAND - MARGIN, maxZ: BOUNDS.maxZ + MARGIN,
  }
  const markers: MapMarker[] = [
    ...buildings.filter(b => b.state !== 'unavailable').map((b): MapMarker => {
      const f = footprint(b.door)
      return {
        kind: 'building', id: b.id, icon: b.icon, name: b.name, x: b.door.x, z: b.door.z, state: b.state, cost: b.cost,
        pin: { x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2 },
      }
    }),
    ...STOPS.map((s): MapMarker => ({
      kind: 'stop', id: s.id, icon: s.icon, name: STOP_NAMES[s.id], x: s.x, z: s.z, state: 'stop',
      pin: { x: s.x + LANDMARK_AHEAD * Math.sin(s.face), z: s.z + LANDMARK_AHEAD * Math.cos(s.face) },
    })),
  ]
  const half = MARKER_SIZE / 2
  spread(markers.map(m => m.pin), { minX: box.minX + half, maxX: box.maxX - half, minZ: box.minZ + half, maxZ: box.maxZ - half })
  return {
    viewBox: `${box.minX} ${box.minZ} ${box.maxX - box.minX} ${box.maxZ - box.minZ}`,
    box,
    districts: DISTRICTS.map(d => ({ id: d.id, areas: d.areas })),
    streets: ALL_STREETS,
    plaza: PLAZA,
    hills: HILLS,
    lake: LAKE,
    mountains: { minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: BOUNDS.minZ },
    markers,
  }
}
