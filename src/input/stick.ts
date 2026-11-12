export interface Point {
  x: number
  y: number
}

/** How far (px) the finger is dragged for full speed */
export const STICK_RADIUS = 60
/** A drag this short (px) is a resting finger, not a wish to walk */
export const STICK_DEAD = 10

/**
 * Movement for a finger at `point` when the stick started at `origin`.
 * The length runs from 0 at the dead zone to 1 at the radius; down the screen is towards the camera.
 */
export function stickVector(origin: Point, point: Point): { x: number; z: number } {
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const distance = Math.hypot(dx, dy)
  if (distance <= STICK_DEAD) return { x: 0, z: 0 }
  const strength = Math.min(1, (distance - STICK_DEAD) / (STICK_RADIUS - STICK_DEAD))
  return { x: (dx / distance) * strength, z: (dy / distance) * strength }
}
