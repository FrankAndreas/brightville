/** Which side of the square a door building stands on; its door faces the middle */
export type Side = 'back' | 'left' | 'right' | 'front'

/** Where a door is: the spot in front of it the child walks to, and the side its house stands on */
export interface DoorSpot {
  x: number
  z: number
  /** The back when not given */
  side?: Side
}

export interface DoorDef extends DoorSpot {
  id: string
  /** Closed doors are shown but can't be entered on this device */
  open: boolean
  /** Picture for the sign above the door */
  icon?: string
  /** Closed until today's learning is done: shown with a lock */
  locked?: boolean
}

/** A door building is 8 m wide and 5 m deep, and stands 1 m behind its door */
export const HOUSE_WIDTH = 8
export const HOUSE_DEPTH = 5
const SETBACK = 1

export interface Footprint {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** The ground a door's house covers. */
export function footprint(door: DoorSpot): Footprint {
  const half = HOUSE_WIDTH / 2
  switch (door.side ?? 'back') {
    case 'left':
      return { minX: door.x - SETBACK - HOUSE_DEPTH, maxX: door.x - SETBACK, minZ: door.z - half, maxZ: door.z + half }
    case 'right':
      return { minX: door.x + SETBACK, maxX: door.x + SETBACK + HOUSE_DEPTH, minZ: door.z - half, maxZ: door.z + half }
    case 'front':
      return { minX: door.x - half, maxX: door.x + half, minZ: door.z + SETBACK, maxZ: door.z + SETBACK + HOUSE_DEPTH }
    default:
      return { minX: door.x - half, maxX: door.x + half, minZ: door.z - SETBACK - HOUSE_DEPTH, maxZ: door.z - SETBACK }
  }
}

/** Turn about the vertical axis that makes a house built facing +z face the middle from this side. */
export function facingAngle(side: Side): number {
  return side === 'left' ? Math.PI / 2 : side === 'right' ? -Math.PI / 2 : side === 'front' ? Math.PI : 0
}

/** How close (metres) the character must be to a door to use it */
export const DOOR_RADIUS = 2.5

export function nearestDoor(pos: { x: number; z: number }, doors: DoorDef[]): DoorDef | null {
  let best: DoorDef | null = null
  let bestDistance = DOOR_RADIUS
  for (const door of doors) {
    const distance = Math.hypot(door.x - pos.x, door.z - pos.z)
    if (distance <= bestDistance) {
      best = door
      bestDistance = distance
    }
  }
  return best
}
