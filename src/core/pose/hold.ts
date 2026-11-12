/** How long a pose must be held */
export const HOLD_MS = 5000
/** The ring empties at half the speed it fills: a wobble costs little */
export const DRAIN_FACTOR = 0.5
/** After this long without success the teacher simply moves on */
export const POSE_TIMEOUT_MS = 30000

export interface Hold {
  update(matching: boolean, dtMs: number): { progress: number; status: 'holding' | 'done' | 'timeout' }
}

/** The filling ring for one pose. */
export function createHold(): Hold {
  let heldMs = 0
  let elapsedMs = 0
  return {
    update(matching, dtMs) {
      const dt = dtMs > 0 ? dtMs : 0
      elapsedMs += dt
      heldMs = matching ? Math.min(HOLD_MS, heldMs + dt) : Math.max(0, heldMs - dt * DRAIN_FACTOR)
      const progress = heldMs / HOLD_MS
      if (heldMs >= HOLD_MS) return { progress: 1, status: 'done' }
      // Never cut off a child who is in the pose right now
      return { progress, status: !matching && elapsedMs >= POSE_TIMEOUT_MS ? 'timeout' : 'holding' }
    },
  }
}
