export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
}

/** True if a and b point in opposite directions. */
export function isOpposite(a: Direction, b: Direction): boolean {
  return DIRS[a].x === -DIRS[b].x && DIRS[a].y === -DIRS[b].y
}

/** Arrow keys and WASD (either case) to a direction, otherwise null. */
export function keyToDirection(key: string): Direction | null {
  return KEYS[key] ?? KEYS[key.toLowerCase()] ?? null
}

/**
 * Direction of a swipe along its dominant axis, or null for a movement
 * shorter than `threshold` pixels (a tap with a slightly moving finger).
 */
export function swipeDirection(dx: number, dy: number, threshold = 24): Direction | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}
