import type { Intents } from '@/input/intents'
import { PLAZA } from './map'

/** Radians per second while J or L (or a turn button) is held: a quarter turn in a little over a second */
export const TURN_SPEED = 1.4
// How quickly a turn-around or look-back closes the gap: most of it within half a second
const SWING_RATE = 8
/** How quickly the view swings round behind her on the bicycle: gently, so corners don't swing the whole town about */
const RIDE_SWING_RATE = 2.5

/**
 * Where the keys walk when the view is turned by `yaw` (0 looks along -z; the camera sits at
 * (sin yaw, cos yaw) behind the character). "Up" always walks away from the camera.
 */
export function walkDirection(yaw: number, moveX: number, moveZ: number): { x: number; z: number } {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: moveX * c + moveZ * s, z: -moveX * s + moveZ * c }
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export interface View {
  /** Radians around the vertical axis */
  readonly yaw: number
  /** `at`: where she is, so looking home turns towards the plaza */
  step(intents: Pick<Intents, 'turn' | 'turnAround' | 'lookHome'>, dt: number, at?: { x: number; z: number }): void
  /** On the bicycle: swings round behind her, riding the way `heading` faces (CharacterFrame.heading) */
  behind(heading: number, dt: number): void
}

/** The way the camera looks: turned by hand, swung around, or home: towards the plaza (on the plaza, the first way). */
export function createView(): View {
  let yaw = 0
  /** Where a turn-around or look-back is heading; null while turning by hand or resting */
  let target: number | null = null
  return {
    get yaw() {
      return yaw
    },
    step(intents, dt, at) {
      if (intents.turnAround) target = (target ?? yaw) + Math.PI
      if (intents.lookHome) {
        const away = at ? Math.hypot(at.x - PLAZA.x, at.z - PLAZA.z) : 0
        // The camera looks along -(sin, cos): towards the plaza from (x, z) is yaw atan2(x, z)
        const home = away > PLAZA.radius && at ? Math.atan2(at.x - PLAZA.x, at.z - PLAZA.z) : 0
        target = yaw + wrap(home - yaw)
      }
      if (intents.turn !== 0) {
        target = null
        // Right (L) turns the view clockwise, seen from above
        yaw -= intents.turn * TURN_SPEED * dt
        return
      }
      if (target === null) return
      const gap = target - yaw
      if (Math.abs(gap) < 0.002) {
        yaw = target
        target = null
        return
      }
      yaw += gap * (1 - Math.exp(-SWING_RATE * dt))
    },
    behind(heading, dt) {
      target = null
      // She looks along (sin, cos) of her heading; the camera sits at (sin yaw, cos yaw) behind her: yaw = heading + π
      yaw += wrap(heading + Math.PI - yaw) * (1 - Math.exp(-RIDE_SWING_RATE * dt))
    },
  }
}
