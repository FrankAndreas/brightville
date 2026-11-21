import type { Footprint } from '../doors'
import type { District } from './types'

/**
 * Behind the town (−z), past the end of the back avenue: the forest on the left half and the farm on the right. The
 * avenue goes on through the gate to a crossing 22 m in, where a lane turns right to the farmyard and a dirt path left
 * into the forest. The NMG house's lot is on the avenue just past the gate, so she sees it on her way in.
 */
export const NATURE: District = {
  id: 'nature',
  areas: [
    // The forest, green, and the farm, yellow-brown
    { minX: -35, maxX: 0, minZ: -105, maxZ: -60, ground: 0x8cc56f },
    { minX: 0, maxX: 35, minZ: -105, maxZ: -60, ground: 0xd9c78c },
  ],
  streets: [
    // The back avenue, on from its end in the old town to the crossing
    { points: [{ x: 0, z: -56 }, { x: 0, z: -82 }], width: 6 },
    // The farm lane
    { points: [{ x: 0, z: -82 }, { x: 30, z: -82 }], width: 5, kind: 'dirt' },
    // The forest path, narrow and bending into the trees
    { points: [{ x: 0, z: -82 }, { x: -14, z: -82 }, { x: -26, z: -97 }], width: 3, kind: 'dirt' },
  ],
  scenery: [
    // The farmhouse at the end of the lane, and the red barn across from it
    { spot: { x: 24, z: -85, side: 'back' }, w: 7, d: 5, floors: 2, look: { wall: 0xf5ead2, roof: 0xb0503a } },
    { spot: { x: 27, z: -79, side: 'front' }, w: 8, d: 5, floors: 1, look: { wall: 0xc0392b, roof: 0x5b4a44 } },
  ],
  props: [
    // The tractor, parked in the farmyard beside the farmhouse
    { kind: 'tractor', x: 31, z: -88, w: 2.2, d: 3 },
  ],
  lots: [
    { use: 'nmg', spot: { x: 3.5, z: -70, side: 'right' } },
    { use: 'spare', spot: { x: 16, z: -79, side: 'front' } },
  ],
  stops: [
    // At the farm gate, between the farmhouse and the barn, looking at the farmhouse and the pens behind it
    { id: 'bauernhof', icon: '🚜', x: 27, z: -82, face: Math.PI, line: 'Wir fahren zum Bauernhof!' },
    // Where the path leaves the crossing and enters the trees, looking into the forest
    { id: 'wald', icon: '🌲', x: -8, z: -82, face: -Math.PI / 2, line: 'Wir fahren in den Wald!' },
  ],
  gate: { x: 0, z: -60, width: 8 },
}

/** The farm's pens behind the farmhouse, fenced all round: the animals stay inside (src/city/farm.ts) */
export const PENS: Footprint[] = [
  { minX: 6, maxX: 14, minZ: -102, maxZ: -94 },
  { minX: 16, maxX: 24, minZ: -102, maxZ: -94 },
]

/** The field beside the pens, in rows */
export const FIELD: Footprint = { minX: 26.5, maxX: 33, minZ: -103, maxZ: -93 }

/** A round clearing in the forest, in view of the forest's stop: no trees, the deer graze at its edge */
export const CLEARING = { x: -24, z: -80, radius: 5 }
