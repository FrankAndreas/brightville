import { DIRS, isOpposite, type Direction } from './direction'

export const SIZE = 15
export const ITEMS_ON_FIELD = 2

export interface Cell { x: number; y: number }
export interface Item extends Cell { kind: string }
export interface SnakeState {
  /** Head first */
  snake: Cell[]
  dir: Direction
  nextDir: Direction
  items: Item[]
  kinds: string[]
  collected: number
  over: boolean
}

const wrap = (n: number) => (n + SIZE) % SIZE
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y

/**
 * A new round: a snake of length 3 in the centre heading up, and
 * ITEMS_ON_FIELD items of the given kinds (emoji) on free cells.
 */
export function createSnake(kinds: string[], random: () => number = Math.random): SnakeState {
  const c = Math.floor(SIZE / 2)
  const state: SnakeState = {
    snake: [{ x: c, y: c }, { x: c, y: c + 1 }, { x: c, y: c + 2 }],
    dir: 'up',
    nextDir: 'up',
    items: [],
    kinds,
    collected: 0,
    over: false,
  }
  for (let i = 0; i < ITEMS_ON_FIELD; i++) {
    const item = spawnItem(state, random)
    if (item) state.items.push(item)
  }
  return state
}

/**
 * Asks the snake to turn at its next step. Checked against the direction of
 * the last step, so two quick taps can never reverse it into itself.
 */
export function turn(state: SnakeState, dir: Direction): void {
  if (!isOpposite(dir, state.dir)) state.nextDir = dir
}

/** Moves the snake one cell. Returns 'ate', 'crashed' or null. */
export function step(state: SnakeState, random: () => number = Math.random): 'ate' | 'crashed' | null {
  if (state.over) return null
  state.dir = state.nextDir
  const head = state.snake[0]
  const next = { x: wrap(head.x + DIRS[state.dir].x), y: wrap(head.y + DIRS[state.dir].y) }

  const eaten = state.items.findIndex(i => same(i, next))
  // The tail moves away this step unless the snake grows
  const body = eaten === -1 ? state.snake.slice(0, -1) : state.snake
  if (body.some(p => same(p, next))) {
    state.over = true
    return 'crashed'
  }

  state.snake.unshift(next)
  if (eaten === -1) {
    state.snake.pop()
    return null
  }
  state.items.splice(eaten, 1)
  state.collected++
  const item = spawnItem(state, random)
  if (item) state.items.push(item)
  return 'ate'
}

/** A random item on a free cell, or null if the field is full. */
export function spawnItem(state: SnakeState, random: () => number): Item | null {
  const free: Cell[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = { x, y }
      if (!state.snake.some(p => same(p, cell)) && !state.items.some(i => same(i, cell))) free.push(cell)
    }
  }
  if (!free.length) return null
  const cell = free[Math.floor(random() * free.length)]
  return { ...cell, kind: state.kinds[Math.floor(random() * state.kinds.length)] }
}

/** Milliseconds per step: slow at first, a little faster per item, with a floor. */
export function tickMs(collected: number): number {
  return Math.max(140, 260 - 6 * collected)
}
