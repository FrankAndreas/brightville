import type { Intents } from '@/input/intents'

/** Metres per second */
export const WALK_SPEED = 4
/** Metres per second upwards: a jump of about 1.2 m */
export const JUMP_SPEED = 5

/** Ground velocity for the wanted direction; diagonals are no faster. */
export function desiredVelocity(i: Pick<Intents, 'moveX' | 'moveZ'>): { x: number; z: number } {
  const length = Math.hypot(i.moveX, i.moveZ)
  if (length === 0) return { x: 0, z: 0 }
  const scale = WALK_SPEED / Math.max(1, length)
  return { x: i.moveX * scale, z: i.moveZ * scale }
}
