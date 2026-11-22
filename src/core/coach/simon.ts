import type { Body } from '@/core/pose/body'
import { armDown, armUp } from '@/core/moves/arms'
import { matchDance, type DanceMove } from '@/core/moves/dance'
import { createSight } from '@/core/moves/sight'
import { SAY_LOST, SAY_NO_CAMERA, SAY_STEP_IN } from '@/buildings/tanzsaal/flow'
import { SIMON_MOVES, type CoachWords, type SimonMove } from './words'

// "Simon says" / "Jacques a dit" in the Tanzsaal at Oberstufe: fifteen arm commands, two thirds said with "Simon says"
// (do it), the rest without (don't). The camera's setup lines stay German; the commands are in the language.

export const COMMANDS = 15
export const SAID = 10
/** How long he has for a command, counted only while he is seen */
export const REACT_MS = 4000
/** How long a said command must be held to count */
export const HOLD_MS = 300
/** At the start of a command not said: time to lower the arms from the one before */
export const LOWER_MS = 600
/** The pause after a command's answer, before the next one */
export const PAUSE_MS = 900
/** The background beat */
export const BEAT_MS = 600
export const MAX_STARS = 10

const DANCE: Partial<Record<SimonMove, DanceMove>> = {
  bothUp: 'armeHoch', armsOut: 'armeSeite', hips: 'huefte', head: 'kopf', clap: 'klatschen',
}

/** Whether the body does the command now. Left and right are his own; the other arm must be down. */
export function matchSimon(move: SimonMove, b: Body, unit: number): boolean {
  if (move === 'leftUp') return armUp(b, 'l', unit) && armDown(b, 'r', unit)
  if (move === 'rightUp') return armUp(b, 'r', unit) && armDown(b, 'l', unit)
  return matchDance(DANCE[move]!, b, unit)
}

/** Fifteen commands: ten said and five not, mixed (the first one said), never the same move twice in a row */
export function pickCommands(random: () => number): { move: SimonMove; said: boolean }[] {
  const said = [true, ...Array.from({ length: COMMANDS - 1 }, (_, i) => i < SAID - 1)]
  for (let i = said.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(random() * i)
    ;[said[i], said[j]] = [said[j], said[i]]
  }
  const out: { move: SimonMove; said: boolean }[] = []
  for (const s of said) {
    const choices = SIMON_MOVES.filter(m => m !== out[out.length - 1]?.move)
    out.push({ move: choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))], said: s })
  }
  return out
}

/** The Stars for his points: ten for all fifteen, rounded up */
export function simonStars(points: number, of: number): number {
  return Math.ceil((MAX_STARS * points) / of)
}

export type SimonPhase = 'starting' | 'noCamera' | 'settling' | 'command' | 'pause' | 'done'

export interface SimonState {
  phase: SimonPhase
  /** The command being asked (0-based) */
  index: number
  command: { move: SimonMove; said: boolean } | null
  points: number
  /** Per command answered: a point or not */
  results: boolean[]
  seen: boolean
  lost: boolean
}

export type SimonEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

export type SimonEffect =
  /** `ask`: an instruction (for 🔊); `coach`: in the visit's language (the setup lines are German) */
  | { type: 'speak'; text: string; ask?: boolean; coach?: boolean }
  | { type: 'hit' }
  | { type: 'miss' }
  | { type: 'beat' }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface SimonFlow {
  readonly state: SimonState
  send(event: SimonEvent): SimonEffect[]
  earned(): number
}

export function createSimonFlow(commands: { move: SimonMove; said: boolean }[], words: CoachWords): SimonFlow {
  const state: SimonState = { phase: 'starting', index: 0, command: null, points: 0, results: [], seen: false, lost: false }
  const sight = createSight()
  let ms = 0
  let held = 0
  let beats = 0

  function ask(): SimonEffect[] {
    const c = commands[state.index]
    state.command = c
    state.phase = 'command'
    ms = 0
    held = 0
    beats = 0
    return [{ type: 'speak', text: words.simon(c.move, c.said), ask: true, coach: true }]
  }

  function answer(point: boolean, extra: SimonEffect[] = []): SimonEffect[] {
    state.results.push(point)
    if (point) state.points += 1
    const effects: SimonEffect[] = [{ type: point ? 'hit' : 'miss' }, ...extra]
    if (state.index + 1 >= commands.length) {
      state.phase = 'done'
      state.command = null
      return [...effects, { type: 'chime' }, { type: 'confetti' }, { type: 'speak', text: words.done, coach: true }]
    }
    state.phase = 'pause'
    ms = 0
    return effects
  }

  function onFrame(body: Body | null, dtMs: number): SimonEffect[] {
    const dt = Math.max(0, dtMs || 0)
    const s = sight.update(body, dt)
    state.seen = s.seen
    state.lost = s.lost
    const effects: SimonEffect[] = s.sayLost ? [{ type: 'speak', text: SAY_LOST }] : []
    if (state.phase === 'settling') {
      if (s.ready) effects.push(...ask())
      return effects
    }
    // Not seen: the clock waits for him
    if (!s.ready || !body) return effects
    ms += dt
    if (state.phase === 'pause') {
      if (ms >= PAUSE_MS) {
        state.index += 1
        effects.push(...ask())
      }
      return effects
    }
    if (state.phase !== 'command' || !state.command) return effects
    for (; beats * BEAT_MS <= ms; beats++) effects.push({ type: 'beat' })
    const doing = matchSimon(state.command.move, body, s.unit)
    if (state.command.said) {
      held = doing ? held + dt : 0
      if (held >= HOLD_MS) return [...effects, ...answer(true)]
      if (ms >= REACT_MS) return [...effects, ...answer(false)]
      return effects
    }
    if (doing && ms > LOWER_MS) return [...effects, ...answer(false, [{ type: 'speak', text: words.trap, coach: true }])]
    if (ms >= REACT_MS) return [...effects, ...answer(true)]
    return effects
  }

  return {
    state,
    earned: () => simonStars(state.points, commands.length),
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
