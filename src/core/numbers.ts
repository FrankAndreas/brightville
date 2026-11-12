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
const JITTER = 0.15 // of a cell, so neighbours never overlap
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

/** The German word for 0–20, as said when counting ("eins", not "ein"). */
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n)
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

/** Centre points (fractions 0..1) for up to 10 objects: one per cell of a 4×3 grid, jittered. */
export function looseLayout(n: number, random: () => number = Math.random): { x: number; y: number }[] {
  const cells: { col: number; row: number }[] = []
  for (let row = 0; row < LOOSE_ROWS; row++) for (let col = 0; col < LOOSE_COLS; col++) cells.push({ col, row })
  const jitter = () => (random() * 2 - 1) * JITTER
  return shuffle(cells, random).slice(0, n).map(({ col, row }) => ({
    x: (col + 0.5 + jitter()) / LOOSE_COLS,
    y: (row + 0.5 + jitter()) / LOOSE_ROWS,
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
  /** Which Thing is shown: an index into the list of things */
  kind: number
  answer: number
  choices: number[]
}
export type Task =
  | (TaskBase & { type: 'count'; amount: number })
  | (TaskBase & { type: 'dice'; dice: number[] })
  | (TaskBase & { type: 'plus'; a: number; b: number })

export const SESSION_LENGTH = 5
const LATER_ROUNDS: Task['type'][] = ['count', 'dice', 'plus', 'plus']

const int = (lo: number, hi: number, random: () => number) => lo + Math.floor(random() * (hi - lo + 1))

type Draft = Omit<Extract<Task, { type: 'count' }>, 'choices'> | Omit<Extract<Task, { type: 'dice' }>, 'choices'> | Omit<Extract<Task, { type: 'plus' }>, 'choices'>

function makeTask(type: Task['type'], kind: number, random: () => number): Draft {
  switch (type) {
    case 'count': {
      const amount = random() < ZERO_CHANCE ? 0 : int(1, MAX_AMOUNT, random)
      return { type, kind, amount, answer: amount }
    }
    case 'dice': {
      const dice = [int(1, 6, random)]
      return { type, kind, dice, answer: dice[0] }
    }
    case 'plus': {
      const a = int(1, MAX_AMOUNT - 1, random)
      const b = int(1, MAX_AMOUNT - a, random)
      return { type, kind, a, b, answer: a + b }
    }
  }
}

/**
 * Five tasks: a small count to start, then a count, a die and two sums in
 * random order. `kind` indexes the things to count; every task has three choices.
 */
export function buildSession(kindCount: number, random: () => number = Math.random): Task[] {
  const kind = () => Math.floor(random() * kindCount)
  const small = int(1, 5, random)
  const drafts: Draft[] = [
    { type: 'count', kind: kind(), amount: small, answer: small },
    ...shuffle(LATER_ROUNDS, random).map(type => makeTask(type, kind(), random)),
  ]
  // Only counting objects can come to "keine", so only there is 0 a choice
  return drafts.map(t => ({ ...t, choices: answerChoices(t.answer, MAX_AMOUNT, random, t.type === 'count' ? 0 : 1) }) as Task)
}

const group = (n: number, thing: Thing) => (n === 1 ? thing.one : `${numberWord(n)} ${thing.many}`)

/** The spoken question. */
export function questionText(task: Task, thing: Thing): string {
  switch (task.type) {
    case 'count': return `Wie viele ${thing.many}?`
    case 'dice': return 'Wie viele Punkte?'
    case 'plus': return `${group(task.a, thing)} und ${group(task.b, thing)}. Wie viele zusammen?`
  }
}

export function cheerText(answer: number): string {
  const word = numberWord(answer)
  return `Super! ${word[0].toUpperCase()}${word.slice(1)}!`
}

/** How many things a task shows to count: the child can point at each of them. */
export function countable(task: Task): number {
  return task.type === 'plus' ? task.a + task.b : task.answer
}
