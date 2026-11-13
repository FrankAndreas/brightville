import { MIN_VISIBILITY, type Body } from '@/core/pose/body'
import { mid } from '@/core/pose/geometry'
import { bothDown, bothUp } from './arms'
import { upperBodySeen, type SightState } from './sight'

export type MoveId = 'hampelmann' | 'huepfen' | 'kniebeuge' | 'strecken'

/** A position must hold this long to count, so one noisy frame never counts a move */
export const HOLD_PHASE_MS = 60

interface MoveDef {
  id: MoveId
  /** Said when the round starts */
  voice: string
  /** Where a rep starts and ends */
  rest: (b: Body, s: SightState) => boolean
  /** Where it turns */
  peak: (b: Body, s: SightState) => boolean
}

const shouldersY = (b: Body) => mid(b.lShoulder, b.rShoulder).y

/** Hands down low, near the knees; a hand out of the bottom of the picture counts by its elbow */
function handsLow(b: Body, s: SightState): boolean {
  const low = (wrist: Body['lWrist'], elbow: Body['lElbow']) =>
    wrist.visibility >= MIN_VISIBILITY
      ? wrist.y > s.standY + 2 * s.unit
      : elbow.visibility >= MIN_VISIBILITY && elbow.y > shouldersY(b) + 0.3 * s.unit
  return low(b.lWrist, b.lElbow) && low(b.rWrist, b.rElbow)
}

/** The moves of the Hüpfhalle. Each is measured from her own standing height, in shoulder widths. */
export const MOVES: MoveDef[] = [
  {
    id: 'hampelmann', voice: 'Hampelmann! Arme hoch und runter.',
    rest: (b, s) => bothDown(b, s.unit), peak: (b, s) => bothUp(b, s.unit),
  },
  {
    id: 'huepfen', voice: 'Hüpfen! Spring hoch wie ein Frosch.',
    rest: (b, s) => shouldersY(b) > s.standY - 0.1 * s.unit, peak: (b, s) => shouldersY(b) < s.standY - 0.25 * s.unit,
  },
  {
    id: 'kniebeuge', voice: 'Kniebeuge! Geh in die Knie und wieder hoch.',
    rest: (b, s) => shouldersY(b) < s.standY + 0.2 * s.unit, peak: (b, s) => shouldersY(b) > s.standY + 0.6 * s.unit,
  },
  {
    id: 'strecken', voice: 'Strecken! Arme ganz hoch, dann runter zu den Knien.',
    rest: (b, s) => bothUp(b, s.unit), peak: (b, s) => shouldersY(b) > s.standY + 0.5 * s.unit && handsLow(b, s),
  },
]

export const moveDef = (id: MoveId): MoveDef => MOVES.find(m => m.id === id)!

export interface Reps {
  /** True on the frame a rep is finished: back in the starting position after the turn */
  update(body: Body | null, sight: SightState, dtMs: number): boolean
}

/**
 * Counts reps of one move. A rep is rest, peak, rest. Frames without her in view change nothing,
 * so a dropped frame or a moment out of view never loses a rep that was half done.
 */
export function createReps(move: MoveId): Reps {
  const def = moveDef(move)
  let phase: 'start' | 'rest' | 'peak' = 'start'
  let candidate: 'rest' | 'peak' | null = null
  let heldMs = 0

  return {
    update(body, sight, dtMs) {
      if (!body || !sight.ready || !upperBodySeen(body)) return false
      const now = def.peak(body, sight) ? 'peak' : def.rest(body, sight) ? 'rest' : null
      if (now !== candidate) {
        candidate = now
        heldMs = 0
      }
      heldMs += Math.max(0, dtMs || 0)
      if (candidate === null || heldMs < HOLD_PHASE_MS) return false
      if (candidate === 'rest') {
        const finished = phase === 'peak'
        phase = 'rest'
        return finished
      }
      if (phase === 'rest') phase = 'peak'
      return false
    },
  }
}
