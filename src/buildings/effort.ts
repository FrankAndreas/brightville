// A visit to Malen or Ausmalen goes into the logbook and counts towards the "Kunstwerk" sticker only when something
// was really made: walking in and straight out again is no visit.

/** Strokes in Malen, or fills in Ausmalen, in one visit. Taken back ones still count: she was busy. */
export const MIN_MARKS = 10
/** And at least this long inside */
export const MIN_VISIT_MS = 60_000

export interface Effort {
  /** One stroke drawn, or one part filled */
  mark(): void
  /** Whether the visit so far counts */
  counts(): boolean
}

export function createEffort(now: () => number = () => Date.now()): Effort {
  const since = now()
  let marks = 0
  return {
    mark() {
      marks += 1
    },
    counts: () => marks >= MIN_MARKS && now() - since >= MIN_VISIT_MS,
  }
}
