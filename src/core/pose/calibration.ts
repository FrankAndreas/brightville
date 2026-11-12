/** How long the body must stay in view before the poses start */
export const CALIBRATION_MS = 1000

export interface Calibration {
  /** True once the body has been visible for CALIBRATION_MS without a gap */
  update(visible: boolean, dtMs: number): boolean
}

export function createCalibration(): Calibration {
  let visibleMs = 0
  return {
    update(visible, dtMs) {
      visibleMs = visible ? visibleMs + Math.max(0, dtMs || 0) : 0
      return visibleMs >= CALIBRATION_MS
    },
  }
}
