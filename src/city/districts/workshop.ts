import type { District } from './types'

/**
 * To the right of the town (+x), past the end of the right avenue: a paved yard with sheds. The avenue goes on through
 * the gate to the yard's middle, where a cross street runs from one end of the yard to the other.
 */
export const WORKSHOP: District = {
  id: 'workshop',
  // Paved all over, grey
  areas: [{ minX: 60, maxX: 100, minZ: -20, maxZ: 20, ground: 0xc9c6bd }],
  streets: [
    // The right avenue, on from its end in the old town across the yard
    { points: [{ x: 56, z: 0 }, { x: 90, z: 0 }], width: 6 },
    // The cross street
    { points: [{ x: 80, z: -14 }, { x: 80, z: 14 }], width: 6 },
  ],
  scenery: [
    // Two sheds on the cross street
    { spot: { x: 83.5, z: 10, side: 'right' }, w: 6, d: 5, floors: 1, look: { wall: 0xa9b8c6, roof: 0x4f5d6b } },
    { spot: { x: 76.5, z: -14, side: 'left' }, w: 6, d: 5, floors: 2, look: { wall: 0xe0b872, roof: 0x7a5a32 } },
  ],
  props: [
    // The crane past the avenue's end, its arm turning slowly high above the yard
    { kind: 'crane', x: 94, z: 13, w: 1.6, d: 1.6 },
    // Stacks of crates
    { kind: 'crate', x: 66, z: 15, w: 1.4, d: 1.4 },
    { kind: 'crate', x: 70, z: 16, w: 1.4, d: 1.4 },
    { kind: 'crate', x: 92, z: 6, w: 1.4, d: 1.4 },
    { kind: 'crate', x: 95, z: -6, w: 1.4, d: 1.4 },
    { kind: 'crate', x: 96, z: -11, w: 1.4, d: 1.4 },
  ],
  lots: [
    { use: 'beebot', spot: { x: 68, z: -3.5, side: 'back' } },
    { use: 'spare', spot: { x: 68, z: 3.5, side: 'front' } },
    { use: 'spare', spot: { x: 83.5, z: -12, side: 'right' } },
  ],
  stops: [
    // In the middle of the yard, where the streets cross, looking on along the avenue
    { id: 'werkstatt', icon: '🏗️', x: 80, z: 0, face: Math.PI / 2, line: 'Wir fahren zur Werkstatt!' },
  ],
  gate: { x: 60, z: 0, width: 8 },
}
