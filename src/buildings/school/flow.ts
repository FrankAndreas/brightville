import type { Ladder } from '@/core/ladders'
import { cheerText, countable, numberWord, questionText, type Task, type Thing } from '@/core/numbers'

import { SET_BONUS, STARS_PER_TASK } from '../visit'

// The Stars are the same for every learning building (../visit.ts); kept here for the buildings that import them so
export { SET_BONUS, STARS_PER_TASK }

const SAY_RECOUNT = 'Hmm, zähl nochmal mit mir'
const SAY_LISTEN = 'Hör nochmal gut zu'
/** Above this, counting along goes by tens first */
const COUNT_BY_TENS_ABOVE = 20
const SAY_DONE = 'Super gemacht!'

export interface SchoolState {
  /** Current task, 0-based */
  index: number
  /** null once the visit is finished */
  task: Task | null
  /** Choices already tried and faded */
  wrong: number[]
  /** Objects the child has pointed at in this task */
  counted: number
  /** Tasks done */
  solved: number
  stars: number
  /** Each solved task's ladder, and whether it was right on the first try: what moves her up */
  results: { ladder: Ladder; firstTry: boolean }[]
  phase: 'asking' | 'cheering' | 'recounting' | 'done'
}

/** Things for the screen to do; the flow itself touches no browser API. */
export type SchoolEffect =
  /** `ask`: an instruction, kept for the 🔊 button */
  | { type: 'speak'; text: string; ask?: boolean }
  | { type: 'chime' }
  /** Count this many objects aloud, one by one (`tens`: ten at a time first), then call recountDone() */
  | { type: 'recount'; amount: number; tens?: boolean }
  | { type: 'confetti' }

export interface SchoolFlow {
  readonly state: SchoolState
  /** Asks the first question */
  start(): SchoolEffect[]
  /** The child points at one more object (`by`: a tens bar counts ten) */
  touch(by?: number): SchoolEffect[]
  answer(choice: number): SchoolEffect[]
  /** The count-along is over: the child may answer again */
  recountDone(): SchoolEffect[]
  /** After the cheer: the next question, or the end of the visit */
  next(): SchoolEffect[]
}

/** One visit to the School: a row of tasks, each ending only when it is right. */
export function createSchoolFlow(tasks: Task[], things: Thing[]): SchoolFlow {
  const state: SchoolState = {
    index: 0, task: tasks[0] ?? null, wrong: [], counted: 0, solved: 0, stars: 0, results: [],
    phase: tasks.length > 0 ? 'asking' : 'done',
  }
  const ask = (task: Task): SchoolEffect[] => [{ type: 'speak', text: questionText(task, things[task.kind % things.length]), ask: true }]

  return {
    state,
    start: () => (state.phase === 'asking' && state.task ? ask(state.task) : []),

    touch(by = 1) {
      if (state.phase !== 'asking' || !state.task || state.counted >= countable(state.task)) return []
      state.counted = Math.min(state.counted + by, countable(state.task))
      return [{ type: 'speak', text: numberWord(state.counted) }]
    },

    answer(choice) {
      const task = state.task
      if (state.phase !== 'asking' || !task) return []
      if (!task.choices.includes(choice) || state.wrong.includes(choice)) return []
      if (choice === task.answer) {
        state.phase = 'cheering'
        state.solved += 1
        state.results.push({ ladder: task.ladder, firstTry: state.wrong.length === 0 })
        state.stars += STARS_PER_TASK
        // The bonus is earned with the last right answer, so leaving during the cheer keeps it
        if (state.solved === tasks.length) state.stars += SET_BONUS
        return [{ type: 'chime' }, { type: 'speak', text: cheerText(task.answer) }]
      }
      // Never a buzzer: the wrong button fades and we count together
      state.wrong.push(choice)
      // Counting on has nothing to point at: the numbers are said again
      if (task.type === 'next') return [{ type: 'speak', text: SAY_LISTEN }, ...ask(task)]
      state.phase = 'recounting'
      state.counted = 0
      const amount = countable(task)
      return [
        { type: 'speak', text: SAY_RECOUNT },
        amount > COUNT_BY_TENS_ABOVE ? { type: 'recount', amount, tens: true } : { type: 'recount', amount },
      ]
    },

    recountDone() {
      if (state.phase !== 'recounting' || !state.task) return []
      state.phase = 'asking'
      state.counted = countable(state.task)
      return []
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.wrong = []
      state.counted = 0
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
