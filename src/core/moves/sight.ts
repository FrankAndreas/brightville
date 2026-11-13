import { MIN_VISIBILITY, type Body, type Point } from '@/core/pose/body'
import { distance, mid } from '@/core/pose/geometry'

/** Seen this long without a gap before moves count, so her standing height can be learnt */
export const SETTLE_MS = 1000
/** Unseen this long: lost. Shorter gaps are the tracker dropping a frame. */
export const LOST_AFTER_MS = 1500
/** While lost, the voice says so again after this long */
export const SAY_AGAIN_MS = 8000
// How quickly her standing height follows small changes, and how close they must be to count as standing
const DRIFT_MS = 2000
const DRIFT_WITHIN = 0.15

export interface SightState {
  /** Head and shoulders in this frame */
  seen: boolean
  /** Settled: moves may count */
  ready: boolean
  /** Unseen for longer than a dropped frame */
  lost: boolean
  /** True on the frames the voice should say she isn't seen */
  sayLost: boolean
  /** The height of her shoulders when standing, and her shoulder width: the ruler for every move */
  standY: number
  unit: number
}

export interface Sight {
  update(body: Body | null, dtMs: number): SightState
}

const seen = (p: Point) => p.visibility >= MIN_VISIBILITY

/** Head and shoulders: all the moves need, so she can stand close to the camera. */
export function upperBodySeen(b: Body): boolean {
  return seen(b.nose) && seen(b.lShoulder) && seen(b.rShoulder)
}

/** Follows whether she is in view and how she stands when she isn't moving. */
export function createSight(): Sight {
  let seenMs = 0
  let unseenMs = 0
  let sinceSaid = 0
  let samples = 0
  /** Seen and settled at least once in this visit */
  let wasReady = false
  const state: SightState = { seen: false, ready: false, lost: false, sayLost: false, standY: 0, unit: 0 }

  return {
    update(body, dtMs) {
      const dt = Math.max(0, dtMs || 0)
      state.sayLost = false
      state.seen = body !== null && upperBodySeen(body)
      if (!state.seen) {
        unseenMs += dt
        seenMs = 0
        if (state.lost) {
          sinceSaid += dt
          if (sinceSaid >= SAY_AGAIN_MS) {
            sinceSaid = 0
            state.sayLost = true
          }
        } else if (unseenMs >= LOST_AFTER_MS) {
          state.lost = true
          state.ready = false
          // At the very start the building has just asked her to step in: let that be heard out first
          state.sayLost = wasReady
          sinceSaid = 0
          samples = 0
        }
        return { ...state }
      }

      unseenMs = 0
      state.lost = false
      const y = mid(body!.lShoulder, body!.rShoulder).y
      const width = distance(body!.lShoulder, body!.rShoulder)
      if (!state.ready) {
        // Settling: the average of what she showed so far
        samples += 1
        state.standY += (y - state.standY) / samples
        state.unit += (width - state.unit) / samples
        seenMs += dt
        state.ready = seenMs >= SETTLE_MS
        wasReady ||= state.ready
      } else if (Math.abs(y - state.standY) < DRIFT_WITHIN * state.unit) {
        const k = Math.min(1, dt / DRIFT_MS)
        state.standY += (y - state.standY) * k
        state.unit += (width - state.unit) * k
      }
      return { ...state }
    },
  }
}
