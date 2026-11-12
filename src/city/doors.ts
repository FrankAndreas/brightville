export interface DoorDef {
  id: string
  x: number
  z: number
  /** Closed doors are shown but can't be entered on this device */
  open: boolean
  /** Picture for the sign above the door */
  icon?: string
  /** Closed until today's learning is done: shown with a lock */
  locked?: boolean
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
