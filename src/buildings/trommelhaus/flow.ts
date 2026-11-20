import { judge, taskText, type Hit, type Mode, type RhythmTask } from '@/core/rhythm'
import { SET_BONUS, STARS_PER_TASK } from '../school/flow'

const SAY_CHOOSE = 'Willst du tippen oder klatschen?'
const SAY_SHOW = 'Schau und hör zu, so geht das.'
const SAY_CHEER = 'Super!'
const SAY_AGAIN = 'Hör nochmal gut zu.'
const SAY_HOW = 'Hör zu, so geht’s.'
const SAY_ON = 'Das üben wir noch. Weiter geht’s!'
const SAY_NO_MIC = 'Das Mikrofon hört gerade nicht zu. Dann tippen wir!'
const SAY_DEAF = 'Ich höre dich nicht. Tipp einfach auf die Trommel!'
const SAY_DONE = 'Super gemacht!'
/** After this many misses the task is shown and the visit goes on */
const TRIES = 3
/** Silences that count as one try */
const SILENCES_PER_TRY = 2
/** Tasks running in which the microphone heard nothing, before tapping takes over */
const DEAF_TASKS = 2

export type RhythmEffect =
  | { type: 'speak'; text: string; ask?: boolean }
  /** Her turn: the house plays the task, then (or, keeping a beat, while it goes on) she answers */
  | { type: 'turn'; task: RhythmTask; mode: Mode }
  /** The house plays the task once to show it; nothing to answer */
  | { type: 'show'; task: RhythmTask; mode: Mode }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface RhythmState {
  index: number
  task: RhythmTask | null
  mode: Mode
  /** Misses in this task */
  tries: number
  /** Silences in this task */
  silences: number
  /** Tasks running in which the microphone heard nothing */
  deaf: number
  solved: number
  stars: number
  results: { ladder: 'rhythmus'; firstTry: boolean }[]
  phase: 'choosing' | 'example' | 'turn' | 'cheering' | 'done'
}

export interface RhythmFlow {
  readonly state: RhythmState
  /** Asks tapping or clapping */
  start(): RhythmEffect[]
  /** She chose (or the device can only tap) */
  choose(mode: Mode): RhythmEffect[]
  /** She chose clapping, but the microphone said no: tapping */
  micFailed(): RhythmEffect[]
  /** The example was shown: her first turn */
  exampleDone(): RhythmEffect[]
  /** Her answer to a turn */
  answered(hits: Hit[]): RhythmEffect[]
  /** She didn't start in time */
  silent(): RhythmEffect[]
  /** After the cheer: the next task, or the end */
  next(): RhythmEffect[]
}

/** One visit to the Trommelhaus: she chooses how to answer, an example while she is new to the step, five tasks */
export function createRhythmFlow(tasks: RhythmTask[], example: boolean): RhythmFlow {
  const state: RhythmState = {
    index: 0, task: tasks[0] ?? null, mode: 'tap', tries: 0, silences: 0, deaf: 0, solved: 0, stars: 0, results: [],
    phase: 'choosing',
  }

  const turn = (task: RhythmTask): RhythmEffect => ({ type: 'turn', task, mode: state.mode })
  const ask = (task: RhythmTask): RhythmEffect[] => [{ type: 'speak', text: taskText(task, state.mode), ask: true }, turn(task)]

  function begin(): RhythmEffect[] {
    const task = state.task
    if (!task) {
      state.phase = 'done'
      return []
    }
    if (example) {
      state.phase = 'example'
      return [{ type: 'speak', text: SAY_SHOW, ask: true }, { type: 'show', task, mode: state.mode }]
    }
    state.phase = 'turn'
    return ask(task)
  }

  function solve(firstTry: boolean) {
    state.phase = 'cheering'
    state.solved += 1
    state.results.push({ ladder: 'rhythmus', firstTry })
    state.stars += STARS_PER_TASK
    if (state.solved === tasks.length) state.stars += SET_BONUS
  }

  /** One more miss: again, or after three, shown once more and on */
  function missed(task: RhythmTask): RhythmEffect[] {
    state.tries += 1
    if (state.tries < TRIES) return [{ type: 'speak', text: SAY_AGAIN }, turn(task)]
    solve(false)
    return [{ type: 'speak', text: SAY_HOW }, { type: 'show', task, mode: state.mode }, { type: 'speak', text: SAY_ON }]
  }

  return {
    state,

    start: () => (state.phase === 'choosing' ? [{ type: 'speak', text: SAY_CHOOSE, ask: true }] : []),

    choose(mode) {
      if (state.phase !== 'choosing') return []
      state.mode = mode
      return begin()
    },

    micFailed() {
      if (state.phase !== 'choosing') return []
      state.mode = 'tap'
      return [{ type: 'speak', text: SAY_NO_MIC }, ...begin()]
    },

    exampleDone() {
      if (state.phase !== 'example' || !state.task) return []
      state.phase = 'turn'
      return ask(state.task)
    },

    answered(hits) {
      const task = state.task
      if (state.phase !== 'turn' || !task) return []
      state.deaf = 0
      if (judge(task, hits, state.mode)) {
        solve(state.tries === 0)
        return [{ type: 'chime' }, { type: 'speak', text: SAY_CHEER }]
      }
      return missed(task)
    },

    silent() {
      const task = state.task
      if (state.phase !== 'turn' || !task) return []
      state.silences += 1
      if (state.silences % SILENCES_PER_TRY !== 0) return ask(task)
      // Nothing heard twice in this task: with the microphone, that may be the microphone
      if (state.mode === 'clap' && state.silences === SILENCES_PER_TRY) {
        state.deaf += 1
        if (state.deaf >= DEAF_TASKS) {
          state.mode = 'tap'
          state.deaf = 0
          return [{ type: 'speak', text: SAY_DEAF }, turn(task)]
        }
      }
      const effects = missed(task)
      return effects[0].type === 'speak' && effects[0].text === SAY_AGAIN ? ask(task) : effects
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.tries = 0
      state.silences = 0
      const task = tasks[state.index]
      if (!task) {
        state.task = null
        state.phase = 'done'
        return [{ type: 'confetti' }, { type: 'speak', text: SAY_DONE }]
      }
      state.task = task
      state.phase = 'turn'
      return ask(task)
    },
  }
}
