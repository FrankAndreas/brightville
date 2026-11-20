import { againText, setupFor, taskText, type RaumExample, type RaumTask } from '@/core/raum'
import { delta, describe, holds, nounPhrase, OBJECTS, THINGS, type Arrangement, type Place, type WorldObject } from '@/core/world'
import { scoreSolved } from '../visit'

const SAY_CHEER = 'Super!'
const SAY_FREE = 'Super gemacht! Jetzt darfst du frei spielen.'
/** A thing let go this close to the task's object is judged; farther away it is just set down */
const NEAR = 50

export type RaumEffect =
  /** `ask`: an instruction, kept for 🔊 as `again ?? text` */
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  /** Things move to here before a task (only what the task needs has changed) */
  | { type: 'setup'; arrangement: Arrangement }
  /** The example moves a thing */
  | { type: 'show'; thing: string; place: Place }
  | { type: 'chime' }
  /** The tasks are done: free play begins */
  | { type: 'free' }

export interface RaumState {
  /** Current task, 0-based */
  index: number
  /** null once the tasks are done */
  task: RaumTask | null
  /** A wrong thing tapped, or the thing let go near but wrong, in this task */
  missed: boolean
  solved: number
  stars: number
  /** Each solved task, right on the first try or not: what moves her up */
  results: { ladder: 'raum'; firstTry: boolean }[]
  phase: 'example' | 'asking' | 'cheering' | 'free'
}

export interface RaumFlow {
  readonly state: RaumState
  /** The example (phase 'example') or the first task */
  start(): RaumEffect[]
  /** The example has been shown: the first task */
  exampleDone(): RaumEffect[]
  /** She taps a thing (a finding task) */
  tapThing(id: string): RaumEffect[]
  /** She let go of a thing, and it came to rest at `place` (a placing task) */
  released(id: string, place: Place): RaumEffect[]
  /** After the cheer: the next task, or free play */
  next(): RaumEffect[]
}

const thingName = (id: string, kase: 'nom' | 'acc') => {
  const t = THINGS.find(x => x.id === id)
  return t ? nounPhrase(t, kase) : id
}

/**
 * One visit to the Spielwelt: an example while she is new to the step, five tasks (each ends only when right), then
 * free play. `arrangement`, `viewCentre` (the middle of what she sees) and `objects` (with the car where it is now)
 * are read when they are needed.
 */
export function createRaumFlow(
  tasks: RaumTask[], example: RaumExample | null, arrangement: () => Arrangement, viewCentre: () => number, step: number,
  objects: () => WorldObject[] = () => OBJECTS,
): RaumFlow {
  const state: RaumState = {
    index: 0, task: tasks[0] ?? null, missed: false, solved: 0, stars: 0, results: [],
    phase: tasks.length === 0 ? 'free' : example ? 'example' : 'asking',
  }

  const ask = (task: RaumTask): RaumEffect[] => [
    { type: 'setup', arrangement: setupFor(task, arrangement(), viewCentre(), step, objects()) },
    // A placing task lights its object; a finding task leaves her to look
    {
      type: 'speak', text: taskText(task), ...(task.type === 'place' ? { light: `object-${task.clues[0].object}` } : {}),
      ask: true,
    },
  ]

  function solve() {
    state.phase = 'cheering'
    scoreSolved(state, 'raum', !state.missed, tasks.length)
  }

  return {
    state,

    start() {
      if (state.phase === 'example' && example) {
        const all = example.lines.map(l => l.text).join(' ')
        return example.lines.flatMap((line, i): RaumEffect[] => [
          { type: 'show', thing: example.thing, place: line.place },
          { type: 'speak', text: line.text, ...(i === 0 ? { ask: true, again: all } : {}) },
        ])
      }
      return state.phase === 'asking' && state.task ? ask(state.task) : []
    },

    exampleDone() {
      if (state.phase !== 'example' || !state.task) return []
      state.phase = 'asking'
      return ask(state.task)
    },

    tapThing(id) {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'find') return []
      if (id === task.thing) {
        solve()
        return [{ type: 'chime' }, { type: 'speak', text: `${SAY_CHEER} Da ist ${thingName(id, 'nom')}!` }]
      }
      state.missed = true
      return [{ type: 'speak', text: `Das ist ${thingName(id, 'nom')}. ${taskText(task)}` }]
    },

    released(id, place) {
      const task = state.task
      if (state.phase !== 'asking' || task?.type !== 'place' || id !== task.thing) return []
      const world = objects()
      const near = task.clues.some(c => [c.object, c.other].some(o => {
        const obj = world.find(x => x.id === o)
        return obj && Math.abs(delta(obj.x, place.x)) <= NEAR
      }))
      if (!near) return []
      const unmet = task.clues.filter(c => !holds(place, c, world))
      if (unmet.length === 0) {
        solve()
        return [{ type: 'chime' }, { type: 'speak', text: SAY_CHEER }]
      }
      // It stays where she put it: the voice says where that is, and asks for what is still missing
      state.missed = true
      return [{ type: 'speak', text: `${describe(id, place, world)} ${againText(task, unmet)}` }]
    },

    next() {
      if (state.phase !== 'cheering') return []
      state.index += 1
      state.missed = false
      const task = tasks[state.index]
      if (!task) {
        state.task = null
        state.phase = 'free'
        return [{ type: 'free' }, { type: 'speak', text: SAY_FREE }]
      }
      state.task = task
      state.phase = 'asking'
      return ask(task)
    },
  }
}
