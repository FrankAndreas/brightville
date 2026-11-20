import { pieceName, type MusterExample, type MusterTask } from '@/core/patterns'
import { scoreSolved } from '../visit'

type Row = Extract<MusterTask, { type: 'row' }>
type Sort = Extract<MusterTask, { type: 'sort' }>

const SAY_LISTEN = 'Hör nochmal:'
const SAY_CHEER = 'Super!'
const SAY_DONE = 'Super gemacht!'
const SAY_HOW = 'Tippe ein Ding an und dann seinen Korb.'
/** Said at a gap inside a row, while the gap lights up */
const SAY_GAP = 'hmm'

export type MusterEffect =
  /**
   * Said while `light` is lit ('piece-<i>', 'gap', 'choice-<i>', 'basket-<0|1>', 'thing-<id>'). `ask`: an instruction,
   * kept for the 🔊 button as `again ?? text`.
   */
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  | { type: 'chime' }
  /** A thing went into its basket */
  | { type: 'drop' }
  /** A thing went back from the wrong basket */
  | { type: 'back' }
  /** The example's gap shows its answer from here on */
  | { type: 'fill' }
  | { type: 'confetti' }

export interface MusterState {
  /** Current task, 0-based */
  index: number
  /** null once the visit is finished */
  task: MusterTask | null
  /** A row's choices already tried and faded */
  wrong: number[]
  /** The thing she tapped, waiting for a basket */
  lifted: string | null
  /** Things already in their basket */
  placed: Record<string, 0 | 1>
  /** A thing of this sort went to the wrong basket */
  missed: boolean
  solved: number
  stars: number
  /** Each solved task, right on the first try or not: what moves her up */
  results: { ladder: 'muster'; firstTry: boolean }[]
  phase: 'example' | 'asking' | 'cheering' | 'done'
}

export interface MusterFlow {
  readonly state: MusterState
  /** The example (phase 'example') or the first question */
  start(): MusterEffect[]
  /** The example has been shown: the first question */
  exampleDone(): MusterEffect[]
  /** A row: she taps choice `i` */
  choose(i: number): MusterEffect[]
  /** A sort: she taps a thing */
  lift(thingId: string): MusterEffect[]
  /** A sort: she taps a basket */
  drop(basket: 0 | 1): MusterEffect[]
  /** After the cheer: the next question, or the end of the visit */
  next(): MusterEffect[]
}

const inner = (r: Row) => r.gap < r.pieces.length - 1
const question = (r: Row) => (inner(r) ? 'Was fehlt?' : 'Was kommt jetzt?')

/** The row said piece by piece, each lit; the gap hummed when inside, or (filled) named */
function sayRow(r: Row, filled: boolean): MusterEffect[] {
  return r.pieces.flatMap((p, i): MusterEffect[] => {
    if (i !== r.gap || filled) return [{ type: 'speak', text: pieceName(p, r.feature), light: i === r.gap ? 'gap' : `piece-${i}` }]
    return inner(r) ? [{ type: 'speak', text: SAY_GAP, light: 'gap' }] : []
  })
}

/** The row in words for the 🔊 button: "rot, blau, rot, blau … Was kommt jetzt?" */
function rowText(r: Row): string {
  const parts = r.pieces.flatMap((p, i) => (i !== r.gap ? [pieceName(p, r.feature)] : inner(r) ? [SAY_GAP] : []))
  return inner(r) ? `${parts.join(', ')}. ${question(r)}` : `${parts.join(', ')} … ${question(r)}`
}

function askRow(r: Row): MusterEffect[] {
  return [...sayRow(r, false), { type: 'speak', text: question(r), light: 'gap', ask: true, again: rowText(r) }]
}

function askSort(s: Sort): MusterEffect[] {
  const first = `Die ${s.baskets[0]} kommen hierhin,`
  const second = `die ${s.baskets[1]} dorthin.`
  return [
    { type: 'speak', text: first, light: 'basket-0' },
    { type: 'speak', text: second, light: 'basket-1' },
    { type: 'speak', text: SAY_HOW, ask: true, again: `${first} ${second} ${SAY_HOW}` },
  ]
}

const ask = (task: MusterTask) => (task.type === 'row' ? askRow(task) : askSort(task))

function showExample(example: MusterExample): MusterEffect[] {
  const task = example.task
  if (task.type === 'sort') {
    const first = `Die ${task.baskets[0]} kommen in diesen Korb,`
    const second = `die ${task.baskets[1]} in den anderen.`
    const third = `${task.examples[0].the ?? task.examples[0].say} gehört hierhin!`
    return [
      { type: 'speak', text: first, light: 'basket-0', ask: true, again: `${first} ${second} ${third}` },
      { type: 'speak', text: second, light: 'basket-1' },
      { type: 'speak', text: third, light: 'basket-0' },
    ]
  }
  const answer = `${pieceName(task.pieces[task.gap], task.feature)}!`
  return [
    { type: 'speak', text: 'Schau:', ask: true, again: `Schau: ${rowText(task)} ${answer}` },
    ...sayRow(task, false),
    { type: 'speak', text: question(task), light: 'gap' },
    { type: 'fill' },
    { type: 'speak', text: answer, light: 'gap' },
    ...sayRow(task, true),
  ]
}

/** One visit to the Musterwerkstatt: an example while she is new to the step, then tasks that each end only when right */
export function createMusterFlow(tasks: MusterTask[], example: MusterExample | null): MusterFlow {
  const state: MusterState = {
    index: 0, task: tasks[0] ?? null, wrong: [], lifted: null, placed: {}, missed: false, solved: 0, stars: 0,
    results: [], phase: tasks.length === 0 ? 'done' : example ? 'example' : 'asking',
  }

  function solve(firstTry: boolean) {
    state.phase = 'cheering'
    scoreSolved(state, 'muster', firstTry, tasks.length)
  }

  const sortTask = (): Sort | null => (state.phase === 'asking' && state.task?.type === 'sort' ? state.task : null)

  return {
    state,

    start() {
      if (state.phase === 'example' && example) return showExample(example)
      return state.phase === 'asking' && state.task ? ask(state.task) : []
    },

    exampleDone() {
      if (state.phase !== 'example' || !state.task) return []
      state.phase = 'asking'
      return ask(state.task)
    },

    choose(i) {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'row') return []
      if (i < 0 || i >= task.choices.length || state.wrong.includes(i)) return []
      if (i === task.answer) {
        solve(state.wrong.length === 0)
        return [{ type: 'chime' }, ...sayRow(task, true), { type: 'speak', text: SAY_CHEER }]
      }
      // Never a buzzer: the piece fades and the row is said again
      state.wrong.push(i)
      return [{ type: 'speak', text: SAY_LISTEN }, ...askRow(task)]
    },

    lift(thingId) {
      const task = sortTask()
      const thing = task?.things.find(t => t.id === thingId)
      if (!thing || thingId in state.placed) return []
      state.lifted = thingId
      return [{ type: 'speak', text: thing.say, light: `thing-${thingId}` }]
    },

    drop(basket) {
      const task = sortTask()
      const thing = task?.things.find(t => t.id === state.lifted)
      if (!task || !thing) return []
      state.lifted = null
      if (thing.basket !== basket) {
        // It goes back to its place; she tries again
        state.missed = true
        // "Das": no article or plural to get wrong (der Kreis, die Kirschen)
        return [{ type: 'back' }, { type: 'speak', text: 'Das gehört in den anderen Korb. Schau nochmal.' }]
      }
      state.placed = { ...state.placed, [thing.id]: basket }
      if (Object.keys(state.placed).length < task.things.length) return [{ type: 'drop' }]
      solve(!state.missed)
      return [{ type: 'drop' }, { type: 'chime' }, { type: 'speak', text: SAY_CHEER }]
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.wrong = []
      state.lifted = null
      state.placed = {}
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
