// Which touch draws: one at a time, and never one much bigger than the pen
// (a resting hand). Browsers report contact sizes very differently (the iPad
// 41.6 px in steps, Firefox 1 px, 0 when unknown), so the size is compared with
// the smallest contact seen, as in writing/tracing.ts.
const HAND_FACTOR = 2

export interface PenFilter {
  /** The pointer that draws, or null */
  pen: number | null
  smallest: number
}

export function createPenFilter(): PenFilter {
  return { pen: null, smallest: Infinity }
}

/** A touch starts; true if it is the pen from now on. */
export function penStart(f: PenFilter, id: number, contactPx: number): boolean {
  if (contactPx > 0) f.smallest = Math.min(f.smallest, contactPx)
  if (f.pen !== null || contactPx > HAND_FACTOR * f.smallest) return false
  f.pen = id
  return true
}

/** A touch ends; true if it was the pen. */
export function penEnd(f: PenFilter, id: number): boolean {
  if (f.pen !== id) return false
  f.pen = null
  return true
}
