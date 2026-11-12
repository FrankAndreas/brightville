import type { Body, Point } from './body'

/** The angle at b between a and c, 0…180 degrees. */
export function angleDeg(a: Point, b: Point, c: Point): number {
  const ux = a.x - b.x, uy = a.y - b.y
  const vx = c.x - b.x, vy = c.y - b.y
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy)
  if (lengths === 0) return 0
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / lengths))
  return (Math.acos(cos) * 180) / Math.PI
}

export function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(a.visibility, b.visibility) }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** The unit all pose rules measure in, so they hold at any distance from the camera. */
export function shoulderWidth(b: Body): number {
  return distance(b.lShoulder, b.rShoulder)
}

/** How far the line from a to b is from level, 0…90 degrees. */
export function tiltDeg(a: Point, b: Point): number {
  return (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180) / Math.PI
}
