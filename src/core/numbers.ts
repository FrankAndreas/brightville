import type { SchoolLadder } from './ladders'

// Counting and first sums. Ported from Spielzeugkiste (src/logic/numbers.js),
// without the rounds and the level up to 20 that the School doesn't have yet.

const WORDS = [
  'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
]

/** The largest amount a task shows or asks for */
export const MAX_AMOUNT = 9
const LOOSE_COLS = 4
const LOOSE_ROWS = 3
/** Up to 20 objects: a finer grid */
const BIG_COLS = 5
const BIG_ROWS = 4
const JITTER = 0.15 // of a cell, so neighbours never overlap
/** On the finer grid a thing nearly fills its cell: less room to move */
const BIG_JITTER = 0.08
const ZERO_CHANCE = 0.1 // how often a count asks for "keine"

/** Deterministic random numbers in [0, 1) for a seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed + 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig']

/** The German word for 0–100, as said when counting ("eins", not "ein"; "einundzwanzig"). */
export function numberWord(n: number): string {
  if (n >= 0 && n <= 20) return WORDS[n]
  if (n === 100) return 'hundert'
  if (!Number.isInteger(n) || n < 0 || n > 100) return String(n)
  const ones = n % 10
  const tens = TENS[Math.floor(n / 10)]
  return ones === 0 ? tens : `${ones === 1 ? 'ein' : WORDS[ones]}und${tens}`
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The answer plus two near numbers (±1, ±2) within min..max, shuffled. */
export function answerChoices(answer: number, max: number, random: () => number = Math.random, min = 0): number[] {
  const near = [answer - 2, answer - 1, answer + 1, answer + 2].filter(n => n >= min && n <= max)
  return shuffle([answer, ...shuffle(near, random).slice(0, 2)], random)
}

/** Centre points (fractions 0..1) for up to 20 objects: one per cell of a 4×3 grid (5×4 above 12), jittered. */
export function looseLayout(n: number, random: () => number = Math.random): { x: number; y: number }[] {
  const big = n > LOOSE_COLS * LOOSE_ROWS
  const cols = big ? BIG_COLS : LOOSE_COLS
  const rows = big ? BIG_ROWS : LOOSE_ROWS
  const cells: { col: number; row: number }[] = []
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) cells.push({ col, row })
  const jitter = () => (random() * 2 - 1) * (big ? BIG_JITTER : JITTER)
  return shuffle(cells, random).slice(0, n).map(({ col, row }) => ({
    x: (col + 0.5 + jitter()) / cols,
    y: (row + 0.5 + jitter()) / rows,
  }))
}

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

/** Pip positions of a die face on a 3×3 grid. */
export function dicePips(value: number): { x: number; y: number }[] {
  return (PIPS[value] ?? []).map(([x, y]) => ({ x, y }))
}

/** Something to count, with the German words for one and for several */
export interface Thing {
  emoji: string
  one: string
  many: string
}

interface TaskBase {
  /** The Lehrplan 21 ladder it belongs to */
  ladder: SchoolLadder
  /** Which Thing is shown: an index into the list of things */
  kind: number
  answer: number
  choices: number[]
}
export type Task =
  | (TaskBase & { type: 'count'; amount: number })
  | (TaskBase & { type: 'dice'; dice: number[] })
  /** `bars`: shown as tens bars and ones (numbers above 20) */
  | (TaskBase & { type: 'plus'; a: number; b: number; bars?: boolean })
  | (TaskBase & { type: 'minus'; a: number; b: number; bars?: boolean })
  /** Counting on (or back) in steps of `by`: `shown` are said, the next one is asked */
  | (TaskBase & { type: 'next'; from: number; by: number; shown: number[] })
  /** Up to five dots, shown only for a moment */
  | (TaskBase & { type: 'flash'; amount: number })
  /** An amount above 20 as tens bars and ones */
  | (TaskBase & { type: 'bars'; amount: number })

/** A visit asks this many tasks of each ladder, Zählen first */
const PER_VISIT: Record<SchoolLadder, number> = { zaehlen: 3, rechnen: 2 }
const LAST_ASKED_STEP = 5
/** The largest number each step asks for, steps 1–5 */
const RANGES: Record<SchoolLadder, number[]> = { zaehlen: [10, 20, 20, 100, 100], rechnen: [5, 10, 10, 20, 100] }

const int = (lo: number, hi: number, random: () => number) => lo + Math.floor(random() * (hi - lo + 1))
const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)]

type Draft = Task extends infer T ? (T extends Task ? Omit<T, 'choices' | 'kind'> : never) : never
type Maker = (random: () => number) => Draft

/** The step a ladder asks at: "fertig" (6) asks step 5 */
const asked = (step: number) => Math.min(Math.max(Math.round(step), 1), LAST_ASKED_STEP)

/** The largest number a ladder's step asks for (and offers as a choice) */
export function stepRange(ladder: SchoolLadder, step: number): number {
  return RANGES[ladder][asked(step) - 1]
}

const count = (lo: number, hi: number): Maker => random => {
  const amount = lo === 0 && random() < ZERO_CHANCE ? 0 : int(Math.max(lo, 1), hi, random)
  return { type: 'count', ladder: 'zaehlen', amount, answer: amount }
}
const dice: Maker = random => {
  const d = int(1, 6, random)
  return { type: 'dice', ladder: 'zaehlen', dice: [d], answer: d }
}
const flash: Maker = random => {
  const amount = int(1, 5, random)
  return { type: 'flash', ladder: 'zaehlen', amount, answer: amount }
}
const bars: Maker = random => {
  const amount = int(21, 100, random)
  return { type: 'bars', ladder: 'zaehlen', amount, answer: amount }
}
/** Counting on or back by one of `bys`, everything within 0..max; `tens`: starting from a ten */
const next = (bys: number[], max: number, tens = false): Maker => random => {
  const by = pick(bys, random)
  const reach = 3 * Math.abs(by)
  // The lowest and highest first number said, so all four numbers stay within 0..max (1.. when counting on)
  const lo = by > 0 ? 1 : reach + 1
  const hi = by > 0 ? max - reach : max
  let from = int(lo, hi, random)
  if (tens) from = Math.min(Math.max(Math.round(from / 10) * 10, by > 0 ? 10 : Math.ceil((reach + 1) / 10) * 10), Math.floor(hi / 10) * 10)
  const shown = [from, from + by, from + 2 * by]
  return { type: 'next', ladder: 'zaehlen', from, by, shown, answer: from + 3 * by }
}
const plus = (max: number): Maker => random => {
  const a = int(1, max - 1, random)
  const b = int(1, max - a, random)
  return { type: 'plus', ladder: 'rechnen', a, b, answer: a + b }
}
const double = (max: number): Maker => random => {
  const a = int(1, Math.floor(max / 2), random)
  return { type: 'plus', ladder: 'rechnen', a, b: a, answer: 2 * a }
}
const minus = (max: number): Maker => random => {
  const a = int(2, max, random)
  const b = int(1, a - 1, random)
  return { type: 'minus', ladder: 'rechnen', a, b, answer: a - b }
}
/** Two-digit numbers up to 100 without carrying, as tens bars and ones (35 + 13, 48 − 23) */
const tensPlus: Maker = random => {
  const aTens = int(1, 8, random), bTens = int(1, 9 - aTens, random)
  const aOnes = int(0, 9, random), bOnes = int(0, 9 - aOnes, random)
  const a = aTens * 10 + aOnes, b = bTens * 10 + bOnes
  return { type: 'plus', ladder: 'rechnen', a, b, answer: a + b, bars: true }
}
const tensMinus: Maker = random => {
  const aTens = int(2, 9, random), bTens = int(1, aTens - 1, random)
  const aOnes = int(0, 9, random), bOnes = int(0, aOnes, random)
  const a = aTens * 10 + aOnes, b = bTens * 10 + bOnes
  return { type: 'minus', ladder: 'rechnen', a, b, answer: a - b, bars: true }
}

/** Per ladder and step: the visit's tasks of that ladder (shuffled after) */
const STEPS: Record<SchoolLadder, Maker[][]> = {
  zaehlen: [
    [count(1, 5), count(0, 10), dice],
    [count(0, 20), dice, next([1], 20)],
    [next([1, -1], 20), next([2], 20), flash],
    [bars, next([1, 2], 100), next([5, 10], 100, true)],
    [next([1, -1], 100), next([2, 5, 10, -2, -5, -10], 100, true), bars],
  ],
  rechnen: [
    [plus(5), plus(5)],
    [plus(10), plus(10)],
    [random => (random() < 0.5 ? plus(10) : double(10))(random), minus(10)],
    [plus(20), minus(20)],
    [tensPlus, tensMinus],
  ],
}

/** Near wrong answers: ±1 and ±2, or ±by and ±2·by when counting in fives or tens */
function near(task: Draft): number[] {
  const unit = task.type === 'next' && Math.abs(task.by) >= 5 ? Math.abs(task.by) : 1
  return [-2, -1, 1, 2].map(k => task.answer + k * unit)
}

function choicesFor(task: Draft, max: number, random: () => number): number[] {
  // Only counting objects can come to "keine", so only there is 0 a choice
  const min = task.type === 'count' ? 0 : 1
  const pool = near(task).filter(n => n >= min && n <= max)
  // Near the edge of the range there may be too few: the plain ±1, ±2, ±3 fill up
  for (const k of [1, -1, 2, -2, 3, -3]) {
    if (pool.length >= 2) break
    const n = task.answer + k
    if (n >= min && n <= max && n !== task.answer && !pool.includes(n)) pool.push(n)
  }
  return shuffle([task.answer, ...shuffle(pool, random).slice(0, 2)], random)
}

/**
 * A visit at her steps: three Zählen tasks, then two Rechnen tasks, each ladder's in random order. `kind` indexes the
 * things to count; every task has three choices within its step's numbers.
 */
export function buildLadderSession(
  steps: Record<SchoolLadder, number>, kindCount: number, random: () => number = Math.random,
): Task[] {
  const tasks: Task[] = []
  for (const ladder of ['zaehlen', 'rechnen'] as SchoolLadder[]) {
    const makers = shuffle(STEPS[ladder][asked(steps[ladder]) - 1], random).slice(0, PER_VISIT[ladder])
    for (const make of makers) {
      const draft = make(random)
      const max = stepRange(ladder, steps[ladder])
      tasks.push({ ...draft, kind: Math.floor(random() * kindCount), choices: choicesFor(draft, max, random) } as Task)
    }
  }
  return tasks
}

const group = (n: number, thing: Thing) => (n === 1 ? thing.one : `${numberWord(n)} ${thing.many}`)

/** What numbers above 20 are shown as: tens bars and single blocks */
export const BLOCK: Thing = { emoji: '🟦', one: 'ein Klötzchen', many: 'Klötzchen' }

/** The spoken question. */
export function questionText(task: Task, thing: Thing): string {
  const shown = 'bars' in task && task.bars ? BLOCK : thing
  switch (task.type) {
    case 'count': return `Wie viele ${thing.many}?`
    case 'dice': return 'Wie viele Punkte?'
    case 'plus': return `${group(task.a, shown)} und ${group(task.b, shown)}. Wie viele zusammen?`
    case 'minus': return `${group(task.a, shown)}. ${group(task.b, shown)} gehen weg. Wie viele bleiben?`
    case 'flash': return 'Schau genau! Wie viele Punkte hast du gesehen?'
    case 'bars': return `Wie viele ${BLOCK.many}?`
    case 'next': {
      const words = task.shown.map(numberWord).join(', ')
      return `${task.by > 0 ? 'Zähl weiter' : 'Zähl rückwärts'}: ${words} … und dann?`
    }
  }
}

export function cheerText(answer: number): string {
  const word = numberWord(answer)
  return `Super! ${word[0].toUpperCase()}${word.slice(1)}!`
}

/** How many things a task shows to count: the child can point at each of them. */
export function countable(task: Task): number {
  switch (task.type) {
    case 'plus': return task.a + task.b
    // What is left: the crossed-out ones can't be pointed at
    case 'minus': return task.a - task.b
    // Nothing to point at: the numbers are only said
    case 'next': return 0
    default: return task.answer
  }
}
