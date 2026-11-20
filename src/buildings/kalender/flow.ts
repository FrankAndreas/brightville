import type { ClockTime, ZeitExample, ZeitTask } from '@/core/kalender'
import { SET_BONUS, STARS_PER_TASK } from '../school/flow'

type Pick = Extract<ZeitTask, { type: 'pick' }>
type Order = Extract<ZeitTask, { type: 'order' }>

const SAY_ORDER = 'Was machst du zuerst? Tippe die Bilder der Reihe nach an.'
const SAY_BEFORE = 'Hmm, was machst du davor?'
const SAY_LISTEN = 'Hör nochmal gut zu.'
const SAY_CHEER = 'Super!'
const SAY_DONE = 'Super gemacht!'

export type ZeitEffect =
  /** Said while `light` is lit ('item-<id>', 'choice-<id>', 'strip-<day>'). `ask`: kept for 🔊 as `again ?? text` */
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  /** An order picture moves into the next place */
  | { type: 'place'; id: string }
  /** The example's clock shows this time */
  | { type: 'clock'; clock: ClockTime }
  /** A picture tapped too early wiggles */
  | { type: 'wiggle'; id: string }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface ZeitState {
  /** Current task, 0-based */
  index: number
  /** null once the visit is finished */
  task: ZeitTask | null
  /** Choices already tried and faded */
  wrong: string[]
  /** Order pictures already in their places, in order */
  placed: string[]
  /** A picture of this order was tapped too early */
  missed: boolean
  solved: number
  stars: number
  /** Each solved task, right on the first try or not: what moves her up */
  results: { ladder: 'zeit'; firstTry: boolean }[]
  phase: 'example' | 'asking' | 'cheering' | 'done'
}

export interface ZeitFlow {
  readonly state: ZeitState
  /** The example (phase 'example') or the first question */
  start(): ZeitEffect[]
  /** The example has been shown: the first question */
  exampleDone(): ZeitEffect[]
  /** A pick: she taps the choice `id` */
  choose(id: string): ZeitEffect[]
  /** An order: she taps the picture `itemId` */
  tap(itemId: string): ZeitEffect[]
  /** After the cheer: the next question, or the end of the visit */
  next(): ZeitEffect[]
}

/**
 * The question (the day it names lit in the week), then (except clocks: that would give the answer) each choice still
 * there, named as it lights up, a day card with its day in the week
 */
function askPick(p: Pick, wrong: string[]): ZeitEffect[] {
  const named = p.topic === 'clock' ? [] : p.choices.filter(c => !wrong.includes(c.id))
  const again = named.length ? `${p.question} ${named.map(c => c.say).join(', ')}.` : p.question
  const light = (c: Pick['choices'][number]) => (c.kind === 'day' ? `choice-${c.id} strip-${c.day}` : `choice-${c.id}`)
  return [
    { type: 'speak', text: p.question, ...(p.focus !== undefined ? { light: `strip-${p.focus}` } : {}), ask: true, again },
    ...named.map((c): ZeitEffect => ({ type: 'speak', text: c.say, light: light(c) })),
  ]
}

/** The question, then each picture still to place, named as it lights up, so she knows what it shows */
function askOrder(o: Order, placed: string[]): ZeitEffect[] {
  const left = o.shown.filter(i => !placed.includes(i.id))
  return [
    { type: 'speak', text: SAY_ORDER, ask: true, again: `${SAY_ORDER} ${left.map(i => i.say).join(', ')}.` },
    ...left.map((i): ZeitEffect => ({ type: 'speak', text: i.say, light: `item-${i.id}` })),
  ]
}
const ask = (task: ZeitTask, wrong: string[] = []) => (task.type === 'order' ? askOrder(task, []) : askPick(task, wrong))

function showExample(example: ZeitExample): ZeitEffect[] {
  const all = example.lines.map(l => l.text).join(' ')
  return example.lines.flatMap((line, i): ZeitEffect[] => [
    ...(line.place ? [{ type: 'place', id: line.place } as ZeitEffect] : []),
    ...(line.clock ? [{ type: 'clock', clock: line.clock } as ZeitEffect] : []),
    { type: 'speak', text: line.text, ...(line.light ? { light: line.light } : {}), ...(i === 0 ? { ask: true, again: all } : {}) },
  ])
}

/** One visit to the Kalender: an example while she is new to the step, then tasks that each end only when right */
export function createZeitFlow(tasks: ZeitTask[], example: ZeitExample | null): ZeitFlow {
  const state: ZeitState = {
    index: 0, task: tasks[0] ?? null, wrong: [], placed: [], missed: false, solved: 0, stars: 0, results: [],
    phase: tasks.length === 0 ? 'done' : example ? 'example' : 'asking',
  }

  function solve(firstTry: boolean) {
    state.phase = 'cheering'
    state.solved += 1
    state.results.push({ ladder: 'zeit', firstTry })
    state.stars += STARS_PER_TASK
    // The bonus is earned with the last right answer, so leaving during the cheer keeps it
    if (state.solved === tasks.length) state.stars += SET_BONUS
  }

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

    choose(id) {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'pick') return []
      const choice = task.choices.find(c => c.id === id)
      if (!choice || state.wrong.includes(id)) return []
      if (id === task.answer) {
        solve(state.wrong.length === 0)
        return [{ type: 'chime' }, { type: 'speak', text: `${choice.say}! ${SAY_CHEER}` }]
      }
      // Never a buzzer: the choice fades and the question is asked again
      state.wrong.push(id)
      return [{ type: 'speak', text: SAY_LISTEN }, ...askPick(task, state.wrong)]
    },

    tap(itemId) {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'order') return []
      const item = task.items.find(i => i.id === itemId)
      if (!item || state.placed.includes(itemId)) return []
      if (task.items[state.placed.length].id !== itemId) {
        state.missed = true
        return [{ type: 'wiggle', id: itemId }, { type: 'speak', text: SAY_BEFORE }]
      }
      state.placed = [...state.placed, itemId]
      const effects: ZeitEffect[] = [{ type: 'place', id: itemId }, { type: 'speak', text: item.say, light: `item-${itemId}` }]
      if (state.placed.length < task.items.length) return effects
      solve(!state.missed)
      return [...effects, { type: 'chime' }, { type: 'speak', text: sayOrder(task) }, { type: 'speak', text: SAY_CHEER }]
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.wrong = []
      state.placed = []
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

/** "Zuerst aufstehen, dann frühstücken, dann Mittagessen, dann schlafen." */
const sayOrder = (task: Order) => `Zuerst ${task.items.map(i => i.say).join(', dann ')}.`
