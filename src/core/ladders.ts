// The School's two Lehrplan 21 ladders, Zählen (MA.1.A.2) and Rechnen (MA.1.A.3). The same rule as the server's
// (backend/app/school.py), so a visit moves her up at once and the School goes on while the server is away.

export type Ladder = 'zaehlen' | 'rechnen'
export interface LadderState {
  /** 1–5, 6 = "fertig" (asks step 5) */
  step: number
  /** Her latest first-try answers at this step: right or not */
  window: boolean[]
}
export type Ladders = Record<Ladder, LadderState>

/** Two visits' worth of answers: a visit asks three Zählen and two Rechnen tasks */
export const WINDOW: Record<Ladder, number> = { zaehlen: 6, rechnen: 4 }
export const LAST_STEP = 6
const MISSES_ALLOWED = 1

/** Her answers at the ladder's step: the latest are kept; enough of them with at most one miss move her up */
export function applyResults(s: LadderState, results: boolean[], ladder: Ladder): LadderState {
  if (s.step >= LAST_STEP) return { step: LAST_STEP, window: [] }
  if (results.length === 0) return s
  const size = WINDOW[ladder]
  const kept = [...s.window, ...results].slice(-size)
  if (kept.length >= size && kept.filter(r => !r).length <= MISSES_ALLOWED) return { step: s.step + 1, window: [] }
  return { step: s.step, window: kept }
}

/** Where a child starts: Rechnen at 2 after the old School (sums up to 9) */
export function startLadders(usedSchool: boolean): Ladders {
  return { zaehlen: { step: 1, window: [] }, rechnen: { step: usedSchool ? 2 : 1, window: [] } }
}

/** How far a step is towards the end of Zyklus 1: 0 at step 1, 1 at "fertig" */
export function share(step: number): number {
  return (Math.min(Math.max(step, 1), LAST_STEP) - 1) / (LAST_STEP - 1)
}
