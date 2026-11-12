import { cheerText, countable, numberWord, questionText, type Task, type Thing } from '@/core/numbers'

export const STARS_PER_TASK = 1
/** Extra Stars for finishing the whole visit */
export const SET_BONUS = 5

const SAY_RECOUNT = 'Hmm, zähl nochmal mit mir'
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
  phase: 'asking' | 'cheering' | 'recounting' | 'done'
}

/** Things for the screen to do; the flow itself touches no browser API. */
export type SchoolEffect =
  | { type: 'speak'; text: string }
  | { type: 'chime' }
  /** Count this many objects aloud, one by one, then call recountDone() */
  | { type: 'recount'; amount: number }
  | { type: 'confetti' }

export interface SchoolFlow {
  readonly state: SchoolState
  /** Asks the first question */
  start(): SchoolEffect[]
  /** The child points at one more object */
  touch(): SchoolEffect[]
  answer(choice: number): SchoolEffect[]
  /** The count-along is over: the child may answer again */
  recountDone(): SchoolEffect[]
  /** After the cheer: the next question, or the end of the visit */
  next(): SchoolEffect[]
}

/** One visit to the School: a row of tasks, each ending only when it is right. */
export function createSchoolFlow(tasks: Task[], things: Thing[]): SchoolFlow {
  const state: SchoolState = {
    index: 0, task: tasks[0] ?? null, wrong: [], counted: 0, solved: 0, stars: 0,
    phase: tasks.length > 0 ? 'asking' : 'done',
  }
  const ask = (task: Task): SchoolEffect[] => [{ type: 'speak', text: questionText(task, things[task.kind % things.length]) }]

  return {
    state,
    start: () => (state.phase === 'asking' && state.task ? ask(state.task) : []),

    touch() {
      if (state.phase !== 'asking' || !state.task || state.counted >= countable(state.task)) return []
      state.counted += 1
      return [{ type: 'speak', text: numberWord(state.counted) }]
    },

    answer(choice) {
      const task = state.task
      if (state.phase !== 'asking' || !task) return []
      if (!task.choices.includes(choice) || state.wrong.includes(choice)) return []
      if (choice === task.answer) {
        state.phase = 'cheering'
        state.solved += 1
        state.stars += STARS_PER_TASK
        return [{ type: 'chime' }, { type: 'speak', text: cheerText(task.answer) }]
      }
      // Never a buzzer: the wrong button fades and we count together
      state.wrong.push(choice)
      state.phase = 'recounting'
      state.counted = 0
      return [{ type: 'speak', text: SAY_RECOUNT }, { type: 'recount', amount: countable(task) }]
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
        state.stars += SET_BONUS
        return [{ type: 'confetti' }, { type: 'speak', text: SAY_DONE }]
      }
      state.task = task
      state.phase = 'asking'
      return ask(task)
    },
  }
}
