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
