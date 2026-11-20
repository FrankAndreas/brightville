// The Lehrplan 21 ladders: the School's Zählen (MA.1.A.2) and Rechnen (MA.1.A.3), the Reimhaus's Reimen (D.1.A.1)
// the Musterwerkstatt's Muster (MA.1.B, MA.3) and the Kalender's Zeit (MA.3).
// The same rule as the server's (backend/app/school.py), so a visit moves her up at once and the buildings go on while
// the server is away.

export type Ladder = 'zaehlen' | 'rechnen' | 'reimen' | 'muster' | 'zeit'
export const LADDERS: Ladder[] = ['zaehlen', 'rechnen', 'reimen', 'muster', 'zeit']
/** The two the School asks */
export type SchoolLadder = Exclude<Ladder, 'reimen' | 'muster' | 'zeit'>
export interface LadderState {
  /** 1–5, 6 = "fertig" (asks step 5) */
  step: number
  /** Her latest first-try answers at this step: right or not */
  window: boolean[]
}
export type Ladders = Record<Ladder, LadderState>

/** Two visits' worth of answers: a School visit asks three Zählen and two Rechnen tasks, the others five */
export const WINDOW: Record<Ladder, number> = { zaehlen: 6, rechnen: 4, reimen: 10, muster: 10, zeit: 10 }
export const LAST_STEP = 6
/** How many of the window may be missed on the first try for a move up */
export const MISSES_ALLOWED: Record<Ladder, number> = { zaehlen: 1, rechnen: 1, reimen: 2, muster: 2, zeit: 2 }

/** Her answers at the ladder's step: the latest are kept; enough of them with few enough misses move her up */
export function applyResults(s: LadderState, results: boolean[], ladder: Ladder): LadderState {
  if (s.step >= LAST_STEP) return { step: LAST_STEP, window: [] }
  if (results.length === 0) return s
  const size = WINDOW[ladder]
  const kept = [...s.window, ...results].slice(-size)
  if (kept.length >= size && kept.filter(r => !r).length <= MISSES_ALLOWED[ladder]) return { step: s.step + 1, window: [] }
  return { step: s.step, window: kept }
}

/** Where a child starts: Rechnen at 2 after the old School (sums up to 9) */
export function startLadders(usedSchool: boolean): Ladders {
  return {
    zaehlen: { step: 1, window: [] }, rechnen: { step: usedSchool ? 2 : 1, window: [] },
    reimen: { step: 1, window: [] }, muster: { step: 1, window: [] }, zeit: { step: 1, window: [] },
  }
}

/** How far a step is towards the end of Zyklus 1: 0 at step 1, 1 at "fertig" */
export function share(step: number): number {
  return (Math.min(Math.max(step, 1), LAST_STEP) - 1) / (LAST_STEP - 1)
}
