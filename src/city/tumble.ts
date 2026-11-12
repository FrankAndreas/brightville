/** How long the character rolls around before standing up again */
export const TUMBLE_MS = 1500
/** Metres per second lost in one step */
export const TUMBLE_IMPACT_SPEED = 6
/** Metres fallen before landing */
export const TUMBLE_FALL_HEIGHT = 2.5

/** A hard bump or a long fall makes the character tumble: funny, never a failure. */
export function shouldTumble(impactSpeed: number, fallHeight: number): boolean {
  return impactSpeed > TUMBLE_IMPACT_SPEED || fallHeight > TUMBLE_FALL_HEIGHT
}
