import type { Body } from '@/core/pose/body'
import { MOVES, createReps, type MoveId, type Reps } from '@/core/moves/reps'
import { createSight } from '@/core/moves/sight'
import { BREAK_MS, ROUNDS, SAY_LOST, SAY_NO_CAMERA, SAY_STEP_IN, STARS_PER_ROUND } from '@/buildings/huepfhalle/flow'
import type { CoachWords } from './words'

// The Hüpfhalle at Oberstufe: a counted workout. Three rounds of ten, as for the Kindergarten child, but each round
// split into parts of three to seven ("Do four squats!" then "Do six jumping jacks!"), the coach counting every rep in
// the language. The camera's setup lines stay German.

/** One part of a round: a move and how many */
export interface WorkoutPart {
  move: MoveId
  n: number
}

/** The ways to split a round of ten into parts of three to seven */
const SPLITS: number[][] = [[3, 7], [4, 6], [5, 5], [6, 4], [7, 3], [3, 3, 4], [3, 4, 3], [4, 3, 3]]

export function splitTen(random: () => number): number[] {
  return SPLITS[Math.min(SPLITS.length - 1, Math.floor(random() * SPLITS.length))]
}

/** Three rounds; within a round the move changes from part to part */
export function pickWorkout(random: () => number): WorkoutPart[][] {
  return Array.from({ length: ROUNDS }, () => {
    const parts: WorkoutPart[] = []
    for (const n of splitTen(random)) {
      const choices = MOVES.map(m => m.id).filter(id => id !== parts[parts.length - 1]?.move)
      parts.push({ move: choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))], n })
    }
    return parts
  })
}

export type WorkoutPhase = 'starting' | 'noCamera' | 'settling' | 'moving' | 'break' | 'done'

export interface WorkoutState {
  phase: WorkoutPhase
  move: MoveId | null
  /** 1 for the first round; 0 before */
  round: number
  /** 1 for the first part of the round */
  part: number
  /** How many of this part */
  n: number
  /** Reps of this part; only ever goes up */
  count: number
  /** Reps of this round so far */
  done: number
  stars: number
  seen: boolean
  lost: boolean
}

export type WorkoutEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

export type WorkoutEffect =
  /** `ask`: an instruction (for 🔊); `coach`: in the visit's language (the setup lines are German) */
  | { type: 'speak'; text: string; ask?: boolean; coach?: boolean }
  | { type: 'beat' }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface WorkoutFlow {
  readonly state: WorkoutState
  send(event: WorkoutEvent): WorkoutEffect[]
}

export function createWorkoutFlow(rounds: WorkoutPart[][], words: CoachWords): WorkoutFlow {
  const state: WorkoutState = {
    phase: 'starting', move: null, round: 0, part: 0, n: 0, count: 0, done: 0, stars: 0, seen: false, lost: false,
  }
  const sight = createSight()
  let reps: Reps | null = null
  let breakMs = 0

  function startPart(): WorkoutEffect[] {
    const part = rounds[state.round - 1][state.part - 1]
    state.move = part.move
    state.n = part.n
    state.count = 0
    state.phase = 'moving'
    reps = createReps(part.move)
    return [{ type: 'speak', text: words.workout(part.move, part.n), ask: true, coach: true }]
  }

  function startRound(): WorkoutEffect[] {
    state.round += 1
    state.part = 1
    state.done = 0
    return startPart()
  }

  function counted(): WorkoutEffect[] {
    state.count += 1
    state.done += 1
    const effects: WorkoutEffect[] = [{ type: 'beat' }, { type: 'speak', text: words.number(state.count), coach: true }]
    if (state.count < state.n) return effects
    const parts = rounds[state.round - 1]
    if (state.part < parts.length) {
      state.part += 1
      return [...effects, { type: 'speak', text: words.great, coach: true }, ...startPart()]
    }
    state.stars += STARS_PER_ROUND
    effects.push({ type: 'chime' })
    if (state.round >= rounds.length) {
      state.phase = 'done'
      return [...effects, { type: 'confetti' }, { type: 'speak', text: words.done, coach: true }]
    }
    state.phase = 'break'
    breakMs = 0
    return [...effects, { type: 'speak', text: words.great, coach: true }]
  }

  function onFrame(body: Body | null, dtMs: number): WorkoutEffect[] {
    const s = sight.update(body, dtMs)
    state.seen = s.seen
    state.lost = s.lost
    const effects: WorkoutEffect[] = s.sayLost ? [{ type: 'speak', text: SAY_LOST }] : []
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
