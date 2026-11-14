/** An average frame slower than this (about 45 frames a second) makes the picture a little less sharp */
export const SLOW_FRAME_MS = 22
const STEP = 0.5

/**
 * The pixel ratio for the next while: half a step down while frames are slow, never below 1 and never above what the
 * device has (`max`). It never goes up again in a visit, so the picture doesn't flicker between sharp and soft.
 */
export function nextPixelRatio(current: number, avgFrameMs: number, max: number): number {
  const now = Math.min(current, max)
  return avgFrameMs > SLOW_FRAME_MS ? Math.max(1, now - STEP) : now
}

/** A frame further apart than this is a pause (the iPad locked, another app, a building), not a slow frame */
const PAUSE_MS = 250
const WINDOW_MS = 2000

/**
 * Watches the frames' times and gives a new pixel ratio when two seconds were slow (or null to keep it). A pause
 * starts a new count, and so does the first frame (building the shaders takes long once).
 */
export function createSpeedWatch(max: number) {
  let ratio = max
  let last: number | null = null
  let since = 0
  let frames = 0
  return {
    frame(now: number): number | null {
      if (last === null || now - last > PAUSE_MS) {
        last = since = now
        frames = 0
        return null
      }
      last = now
      frames++
      if (now - since < WINDOW_MS) return null
      const next = nextPixelRatio(ratio, (now - since) / frames, max)
      since = now
      frames = 0
      if (next === ratio) return null
      ratio = next
      return next
    },
    /** After the town was paused: the next frame starts a new count */
    reset() {
      last = null
    },
  }
}
