import type { Example, RhymeTask } from '@/core/rhymes'
import { SET_BONUS, STARS_PER_TASK } from '../school/flow'

const SAY_LISTEN = 'Hör nochmal gut zu.'
const SAY_LISTEN_COUNT = 'Hör nochmal gut zu:'
const SAY_CHEER = 'Super!'
const SAY_DONE = 'Super gemacht!'

export type RhymeEffect =
  /** `ask`: an instruction, kept for the 🔊 button */
  | { type: 'speak'; text: string; ask?: boolean }
  /** Say each word in turn, lighting its picture */
  | { type: 'name'; ids: string[] }
  /** Say the syllables, lighting the drum once each */
  | { type: 'drum'; syllables: string[] }
  | { type: 'chime' }
  /** One drum beat from her tap */
  | { type: 'beat' }
  | { type: 'confetti' }

export interface RhymeState {
  /** Current task, 0-based */
  index: number
  /** null once the visit is finished */
  task: RhymeTask | null
  /** Pictures already tried and faded */
  wrong: string[]
  /** Drum beats she tapped for this task */
  beats: number
  solved: number
  stars: number
  /** Each solved task, right on the first try or not: what moves her up */
  results: { ladder: 'reimen'; firstTry: boolean }[]
  /** A count of this task was wrong */
  missed: boolean
  phase: 'example' | 'asking' | 'cheering' | 'replaying' | 'done'
}

export interface RhymeFlow {
  readonly state: RhymeState
  /** The example (phase 'example') or the first question */
  start(): RhymeEffect[]
  /** The example has been said: the first question */
  exampleDone(): RhymeEffect[]
  /** She taps a picture: her answer */
  pick(id: string): RhymeEffect[]
  /** She taps the drum once */
  tap(): RhymeEffect[]
  /** ↺: the beats start over */
  clear(): RhymeEffect[]
  /** ✓: her count (with at least one beat) */
  done(): RhymeEffect[]
  /** A wrong count's replay is over: she tries again */
  replayDone(): RhymeEffect[]
  /** After the cheer: the next question, or the end of the visit */
  next(): RhymeEffect[]
}

/** One visit to the Reimhaus: an example while she is new to the step, then tasks that each end only when right */
export function createRhymeFlow(tasks: RhymeTask[], example: Example | null): RhymeFlow {
  const state: RhymeState = {
    index: 0, task: tasks[0] ?? null, wrong: [], beats: 0, solved: 0, stars: 0, results: [], missed: false,
    phase: tasks.length === 0 ? 'done' : example ? 'example' : 'asking',
  }

  const ask = (task: RhymeTask): RhymeEffect[] => {
    const say = task.word.say
    if (task.type === 'syllables') return [{ type: 'speak', text: `Wie viele Silben hat ${say}? Trommle mit!`, ask: true }]
    const text = task.type === 'rhyme' ? `Was reimt sich auf ${say}?` : `Was fängt an wie ${say}?`
    return [{ type: 'speak', text, ask: true }, { type: 'name', ids: [task.word.id, ...task.choices.map(c => c.id)] }]
  }

  function solve(firstTry: boolean) {
    state.phase = 'cheering'
    state.solved += 1
    state.results.push({ ladder: 'reimen', firstTry })
    state.stars += STARS_PER_TASK
    // The bonus is earned with the last right answer, so leaving during the cheer keeps it
    if (state.solved === tasks.length) state.stars += SET_BONUS
  }

  return {
    state,

    start() {
      if (state.phase === 'example' && example) return [{ type: 'speak', text: example.text }]
      return state.phase === 'asking' && state.task ? ask(state.task) : []
    },

    exampleDone() {
      if (state.phase !== 'example' || !state.task) return []
      state.phase = 'asking'
      return ask(state.task)
    },

    pick(id) {
      const task = state.task
      if (state.phase !== 'asking' || !task || task.type === 'syllables') return []
      const picked = task.choices.find(c => c.id === id)
      if (!picked || state.wrong.includes(id)) return []
      if (id === task.answer) {
        solve(state.wrong.length === 0)
        return [{ type: 'chime' }, { type: 'speak', text: `${task.word.say} – ${picked.say}! ${SAY_CHEER}` }]
      }
      // Never a buzzer: the picture fades, both words are said, and the rest named again
      state.wrong.push(id)
      const left = task.choices.filter(c => !state.wrong.includes(c.id)).map(c => c.id)
      return [
        { type: 'speak', text: `${task.word.say} … ${picked.say}. ${SAY_LISTEN}` },
        { type: 'name', ids: [task.word.id, ...left] },
      ]
    },

    tap() {
      if (state.phase !== 'asking' || state.task?.type !== 'syllables') return []
      state.beats += 1
      return [{ type: 'beat' }]
    },

    clear() {
      if (state.phase !== 'asking' || state.task?.type !== 'syllables') return []
      state.beats = 0
      return []
    },

    done() {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'syllables' || state.beats === 0) return []
      const drum: RhymeEffect = { type: 'drum', syllables: task.word.syllables }
      if (state.beats === task.answer) {
        solve(!state.missed)
        return [{ type: 'chime' }, drum, { type: 'speak', text: SAY_CHEER }]
      }
      state.missed = true
      state.beats = 0
      state.phase = 'replaying'
      return [{ type: 'speak', text: SAY_LISTEN_COUNT }, drum]
    },

    replayDone() {
      if (state.phase !== 'replaying') return []
      state.phase = 'asking'
      return []
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.wrong = []
      state.beats = 0
      state.missed = false
      const task = tasks[state.index]
      if (!task) {
        state.task = null
        state.phase = 'done'
        return [{ type: 'confetti' }, { type: 'speak', text: SAY_DONE }]
      }
      state.task = task
      state.phase = 'asking'
      return ask(task)
    },
  }
}
