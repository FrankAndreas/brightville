/** Longest physics step, seconds */
export const MAX_FRAME_S = 0.05

/**
 * Frame time safe for physics. After a hidden tab the browser reports seconds
 * at once, which would fling the character through walls.
 */
export function clampFrame(dtSeconds: number): number {
  if (!(dtSeconds > 0)) return 0
  return Math.min(dtSeconds, MAX_FRAME_S)
}
