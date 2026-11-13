import type { Body } from '@/core/pose/body'
import { MOVES, createReps, moveDef, type MoveId, type Reps } from '@/core/moves/reps'
import { createSight } from '@/core/moves/sight'

export const ROUNDS = 3
export const REPS_PER_ROUND = 10
export const STARS_PER_ROUND = 3
/** A breath after a full round, before the next move is named; moves don't count in it */
export const BREAK_MS = 2500
/** From this rep on the voice counts along */
const COUNT_ALOUD_FROM = 7
const NUMBERS = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun']

export const SAY_STEP_IN = 'Stell dich vor die Kamera, so dass ich deinen Kopf und deine Schultern sehe!'
export const SAY_LOST = 'Ich sehe dich nicht. Stell dich vor die Kamera.'
export const SAY_NO_CAMERA = 'Ich finde keine Kamera.'

/** Three different moves for one visit. */
export function pickMoves(random: () => number = Math.random): MoveId[] {
  const pool = MOVES.map(m => m.id)
  const picked: MoveId[] = []
  while (picked.length < ROUNDS) {
    const i = Math.min(pool.length - 1, Math.floor(random() * pool.length))
    picked.push(...pool.splice(i, 1))
  }
  return picked
}

export type JumpPhase = 'starting' | 'noCamera' | 'settling' | 'moving' | 'break' | 'done'

export interface JumpState {
  phase: JumpPhase
  move: MoveId | null
  /** 1 for the first round; 0 before */
  round: number
  /** Reps of this round; only ever goes up */
  count: number
  stars: number
  seen: boolean
  lost: boolean
}

export type JumpEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

export type JumpEffect =
  /** `ask`: an instruction, kept for the 🔊 button */
  | { type: 'speak'; text: string; ask?: boolean }
  | { type: 'beat' }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface JumpFlow {
  readonly state: JumpState
  send(event: JumpEvent): JumpEffect[]
}

/** One visit to the Hüpfhalle: camera, step into view, three rounds of ten, done. Nothing ever counts down. */
export function createJumpFlow(moves: MoveId[]): JumpFlow {
  const state: JumpState = { phase: 'starting', move: null, round: 0, count: 0, stars: 0, seen: false, lost: false }
  const sight = createSight()
  let reps: Reps | null = null
  let breakMs = 0

  function startRound(): JumpEffect[] {
    const move = moves[state.round]
    state.round += 1
    state.move = move
    state.count = 0
    state.phase = 'moving'
    reps = createReps(move)
    return [{ type: 'speak', text: moveDef(move).voice, ask: true }]
  }

  function counted(): JumpEffect[] {
    state.count += 1
    const effects: JumpEffect[] = [{ type: 'beat' }]
    if (state.count < REPS_PER_ROUND) {
      if (state.count >= COUNT_ALOUD_FROM) effects.push({ type: 'speak', text: NUMBERS[state.count - 1] })
      return effects
    }
    state.stars += STARS_PER_ROUND
    effects.push({ type: 'chime' })
    if (state.round >= moves.length) {
      state.phase = 'done'
      return [...effects, { type: 'confetti' }, { type: 'speak', text: 'Zehn! Super gemacht!' }]
    }
    state.phase = 'break'
    breakMs = 0
    return [...effects, { type: 'speak', text: 'Zehn! Super!' }]
  }

  function onFrame(body: Body | null, dtMs: number): JumpEffect[] {
    const s = sight.update(body, dtMs)
    state.seen = s.seen
    state.lost = s.lost
    const effects: JumpEffect[] = s.sayLost ? [{ type: 'speak', text: SAY_LOST }] : []
    if (state.phase === 'settling') {
      if (s.ready) effects.push(...startRound())
    } else if (state.phase === 'break') {
      breakMs += Math.max(0, dtMs || 0)
      if (breakMs >= BREAK_MS) effects.push(...startRound())
    } else if (state.phase === 'moving' && reps?.update(body, s, dtMs)) {
      effects.push(...counted())
    }
    return effects
  }

  return {
    state,
    send(event) {
      if (state.phase === 'done' || state.phase === 'noCamera') return []
      switch (event.type) {
        case 'cameraReady':
          if (state.phase !== 'starting') return []
          state.phase = 'settling'
          return [{ type: 'speak', text: SAY_STEP_IN, ask: true }]
        case 'cameraFailed':
          state.phase = 'noCamera'
          return [{ type: 'speak', text: SAY_NO_CAMERA }]
        case 'frame':
          return onFrame(event.body, event.dtMs)
      }
    },
  }
}
