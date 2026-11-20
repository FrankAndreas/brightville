// Tests only: a child's ladders at the given steps, every other ladder at step 1 with nothing answered
import { LADDERS, type LadderState, type Ladders } from './ladders'

export function laddersAt(steps: Partial<Record<keyof Ladders, number>> = {}): Ladders {
  return Object.fromEntries(LADDERS.map((l): [string, LadderState] => [l, { step: steps[l] ?? 1, window: [] }])) as Ladders
}
