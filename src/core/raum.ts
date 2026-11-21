// The Spielwelt's tasks on the Raum ladder: finding a thing from where it is said to be, and carrying a thing to
// where it should go, with the position words of each step (docs/superpowers/specs/2026-11-20-brightville-spielwelt-design.md).

import { WINDOW } from './ladders'
import {
  BACK_LANE, CAR, delta, FRONT_LANE, GROUND, holds, nounPhrase, OBJECTS, PAIRS, placeFor, prepPhrase, THINGS, wrap,
  WORLD_WIDTH, type Arrangement, type Clue, type Place, type Word, type WorldObject,
} from './world'
import { pick } from './random'

export type RaumTask =
  /** She taps the thing, hidden where the clues say */
  | { type: 'find'; thing: string; clues: Clue[] }
  /** She carries the thing to where the clues say */
  | { type: 'place'; thing: string; clues: Clue[] }

export interface RaumExample { thing: string; lines: { text: string; place: Place }[] }

const LAST_STEP = 6
/** At steps 1–3 the thing to carry starts this close to the object (on its screen) */
const NEAR = 60
const KINDS: RaumTask['type'][] = ['find', 'place', 'place', 'find', 'place']
/** A two-clue spot must be at least this wide */
const MIN_ZONE = 10

const TASK_OBJECTS = OBJECTS.filter(o => o.id !== CAR)
const takes = (o: WorldObject, word: Word) =>
  word === 'auf' ? o.top !== null : word === 'unter' ? o.under : word === 'in' ? o.container : word !== 'zwischen'

/** A place where every clue is true, or null */
export function placeForAll(clues: Clue[], objects: WorldObject[] = OBJECTS): Place | null {
  const first = placeFor(clues[0], objects)
  if (clues.every(c => holds(first, c, objects))) return first
  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    for (const [lane, y] of [['back', BACK_LANE], ['mid', GROUND], ['front', FRONT_LANE]] as const) {
      const p: Place = { x, y, lane }
      if (clues.every(c => holds(p, c, objects))) return p
    }
  }
  return null
}

/** How wide the stretch is where every clue is true (in units; a finger is about 10) */
export function zoneWidth(clues: Clue[], objects: WorldObject[] = OBJECTS): number {
  let best = 0
  for (const [lane, y] of [['back', BACK_LANE], ['mid', GROUND], ['front', FRONT_LANE]] as const) {
    let run = 0
    for (let x = 0; x < WORLD_WIDTH * 2; x += 1) {
      run = clues.every(c => holds({ x: wrap(x), y, lane }, c, objects)) ? run + 1 : 0
      best = Math.max(best, Math.min(run, WORLD_WIDTH))
    }
  }
  return best
}

/** Step 5: two clues to two objects that stand close (in front of or behind one, beside the other), true together on a spot a finger can find */
export const TWO_CLUES: Clue[][] = PAIRS.filter(([a, b]) => a !== CAR && b !== CAR).flatMap(([left, right]) => [
  ...(['vor', 'hinter'] as Word[]).map(w => [{ word: w, object: right }, { word: 'rechts neben' as Word, object: left }]),
  ...(['vor', 'hinter'] as Word[]).map(w => [{ word: w, object: left }, { word: 'links neben' as Word, object: right }]),
]).filter(clues => zoneWidth(clues) >= MIN_ZONE)

function oneClue(words: Word[], random: () => number): Clue[] {
  const word = pick(words, random)
  if (word === 'zwischen') {
    const [a, b] = pick(PAIRS, random)
    return [{ word, object: a, other: b }]
  }
  return [{ word, object: pick(TASK_OBJECTS.filter(o => takes(o, word)), random).id }]
}

type Maker = (random: () => number) => Clue[]
const words = (list: Word[]): Maker => random => oneClue(list, random)
const STEP_1: Word[] = ['auf', 'unter', 'in']
const STEP_2: Word[] = ['neben', 'vor', 'hinter']
const SIDES: Word[] = ['links neben', 'rechts neben']
const two: Maker = random => pick(TWO_CLUES, random)
const any: Maker = random => (random() < 0.3 ? two(random) : oneClue([...STEP_1, ...STEP_2, 'zwischen', ...SIDES], random))

const STEPS: Maker[][] = [
  Array(5).fill(words(STEP_1)),
  Array(5).fill(words(STEP_2)),
  [words(['zwischen']), words(STEP_1), words(STEP_2), words(['zwischen']), words([...STEP_1, ...STEP_2])],
  Array(5).fill(words(SIDES)),
  Array(5).fill(two),
  Array(5).fill(any),
]

/** The five tasks of a visit at `step` (1–5, 6 = "fertig"): two to find, three to place, never the same thing twice in a row */
export function buildRaumSession(step: number, random: () => number = Math.random): RaumTask[] {
  const makers = STEPS[Math.min(Math.max(step, 1), LAST_STEP) - 1]
  let last = ''
  return makers.map((make, i) => {
    const thing = pick(THINGS.filter(t => t.id !== last), random).id
    last = thing
    return { type: KINDS[i], thing, clues: make(random) }
  })
}

const PRONOUN = { m: 'ihn', f: 'sie', n: 'es' } as const
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)
const thingOf = (id: string) => THINGS.find(t => t.id === id) ?? (() => { throw new Error(`no thing ${id}`) })()

/** Where it should go (accusative) or where it is (dative), the clues one after the other */
export const cluesText = (clues: Clue[], kase: 'acc' | 'dat') => clues.map(c => prepPhrase(c, kase)).join(', ')

/** "Leg den Ball auf das Bett." / "Die Katze ist unter dem Tisch. Findest du sie?" */
export function taskText(task: RaumTask): string {
  const thing = thingOf(task.thing)
  if (task.type === 'place') return `Leg ${nounPhrase(thing, 'acc')} ${cluesText(task.clues, 'acc')}.`
  return `${capital(nounPhrase(thing, 'nom'))} ist ${cluesText(task.clues, 'dat')}. Findest du ${PRONOUN[thing.gender]}?`
}

/** "Leg ihn auf das Bett." — `clues`: only those still to be met */
export const againText = (task: RaumTask, clues: Clue[] = task.clues) =>
  `Leg ${PRONOUN[thingOf(task.thing).gender]} ${cluesText(clues, 'acc')}.`

/** A free spot on the ground near `around`: on no object, off the other things, where no clue is true */
function freeSpot(
  around: number, clues: Clue[], arrangement: Arrangement, thing: string, objects: WorldObject[] = OBJECTS, near = NEAR,
): Place {
  // First apart from the other things too; where it's crowded (the house), next to one is fine
  for (const apart of [true, false]) {
    for (let d = 14; d <= near; d += 2) {
      for (const x of [wrap(around + d), wrap(around - d)]) {
        const p: Place = { x, y: GROUND, lane: 'mid' }
        const clear = objects.every(o => Math.abs(delta(o.x, x)) > o.w / 2 + 6)
          && (!apart || Object.entries(arrangement).every(([id, q]) => id === thing || Math.abs(delta(q.x, x)) > 8))
        if (clear && !clues.some(c => holds(p, c, objects))) return p
      }
    }
  }
  return { x: wrap(around + near), y: GROUND, lane: 'mid' }
}

const sameSpot = (a: Place, b: Place) =>
  Math.abs(delta(a.x, b.x)) < 10 && a.lane === b.lane && a.on === b.on && a.inside === b.inside && a.under === b.under

/**
 * Before a task: the things it needs put where it can be done; nothing else moves, except a thing sitting on the very
 * spot the thing to find goes (it would hide it). `viewCentre`: the middle of what she sees; at steps 4 and later the
 * thing to carry starts there, within her view.
 */
export function setupFor(
  task: RaumTask, arrangement: Arrangement, viewCentre: number, step: number, objects: WorldObject[] = OBJECTS,
): Arrangement {
  if (task.type === 'find') {
    const place = placeForAll(task.clues, objects)
    if (!place) return arrangement
    const next = { ...arrangement, [task.thing]: place }
    for (const [id, p] of Object.entries(arrangement)) {
      if (id !== task.thing && sameSpot(p, place)) next[id] = freeSpot(place.x, [], next, id, objects, 2 * NEAR)
    }
    return next
  }
  const object = objects.find(o => o.id === task.clues[0].object)
  if (step <= 3 && object) return { ...arrangement, [task.thing]: freeSpot(object.x, task.clues, arrangement, task.thing, objects) }
  // Within the view (it is about 140 wide): near enough its middle to be seen
  return { ...arrangement, [task.thing]: freeSpot(viewCentre, task.clues, arrangement, task.thing, objects) }
}

const show = (text: string, clue: Clue[]) => {
  const place = placeForAll(clue)
  if (!place) throw new Error(text)
  return { text, place }
}

/** The example before the first task: at steps 1–5 while her answers at the step are fewer than two visits' worth */
export function exampleFor(step: number, windowLength: number): RaumExample | null {
  if (step >= LAST_STEP || windowLength >= WINDOW.raum) return null
  const lines = [
    [show('Schau: Der Ball ist auf dem Tisch.', [{ word: 'auf', object: 'tisch' }]),
      show('Jetzt ist er unter dem Tisch.', [{ word: 'unter', object: 'tisch' }])],
    [show('Schau: Der Ball ist vor dem Baum.', [{ word: 'vor', object: 'baum' }]),
      show('Jetzt ist er hinter dem Baum.', [{ word: 'hinter', object: 'baum' }]),
      show('Und jetzt ist er neben dem Baum.', [{ word: 'neben', object: 'baum' }])],
    [show('Schau: Der Ball ist zwischen der Bank und dem Zaun.', [{ word: 'zwischen', object: 'bank', other: 'zaun' }])],
    [show('Schau: Der Ball ist links neben der Bank.', [{ word: 'links neben', object: 'bank' }]),
      show('Jetzt ist er rechts neben der Bank.', [{ word: 'rechts neben', object: 'bank' }])],
    [show('Schau: Der Ball ist hinter dem Busch, rechts neben dem Stein.',
      [{ word: 'hinter', object: 'busch' }, { word: 'rechts neben', object: 'stein' }])],
  ][step - 1]
  return { thing: 'ball', lines }
}
