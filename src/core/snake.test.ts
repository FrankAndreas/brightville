import { describe, it, expect } from 'vitest'
import { SIZE, ITEMS_ON_FIELD, createSnake, turn, step, spawnItem, tickMs, type Item, type SnakeState } from './snake'
import type { Direction } from './direction'

const KINDS = ['⭐', '💖']
const at = (x: number, y: number) => ({ x, y })

// A state with a given snake (head first), heading and items, no randomness
function state(snake: number[][], dir: Direction, items: Item[] = []): SnakeState {
  return { snake: snake.map(([x, y]) => at(x, y)), dir, nextDir: dir, items, kinds: KINDS, collected: 0, over: false }
}

describe('createSnake', () => {
  it('starts with length 3 in the centre, heading up', () => {
    const s = createSnake(KINDS)
    expect(SIZE).toBe(15)
    expect(s.snake).toEqual([at(7, 7), at(7, 8), at(7, 9)])
    expect(s.dir).toBe('up')
    expect(s.collected).toBe(0)
    expect(s.over).toBe(false)
  })

  it('places items off the snake', () => {
    const s = createSnake(KINDS)
    expect(s.items).toHaveLength(ITEMS_ON_FIELD)
    for (const item of s.items) {
      expect(KINDS).toContain(item.kind)
      expect(s.snake.some(p => p.x === item.x && p.y === item.y)).toBe(false)
    }
  })
})

describe('turn', () => {
  it('ignores a reversal', () => {
    const s = state([[7, 7], [7, 8], [7, 9]], 'up')
    turn(s, 'down')
    expect(s.nextDir).toBe('up')
  })

  it('accepts a sideways turn', () => {
    const s = state([[7, 7], [7, 8], [7, 9]], 'up')
    turn(s, 'left')
    expect(s.nextDir).toBe('left')
  })

  it('never reverses on two quick taps within one tick', () => {
    const s = state([[7, 7], [7, 8], [7, 9]], 'up')
    turn(s, 'left')
    turn(s, 'down')
    step(s)
    expect(s.snake[0]).toEqual(at(6, 7))
    expect(s.over).toBe(false)
  })
})

describe('step', () => {
  it('moves the head and keeps the length', () => {
    const s = state([[7, 7], [7, 8], [7, 9]], 'up')
    expect(step(s)).toBeNull()
    expect(s.snake).toEqual([at(7, 6), at(7, 7), at(7, 8)])
  })

  it('wraps around every edge', () => {
    const left = state([[0, 5], [1, 5], [2, 5]], 'left')
    step(left)
    expect(left.snake[0]).toEqual(at(14, 5))

    const right = state([[14, 5], [13, 5], [12, 5]], 'right')
    step(right)
    expect(right.snake[0]).toEqual(at(0, 5))

    const up = state([[5, 0], [5, 1], [5, 2]], 'up')
    step(up)
    expect(up.snake[0]).toEqual(at(5, 14))

    const down = state([[5, 14], [5, 13], [5, 12]], 'down')
    step(down)
    expect(down.snake[0]).toEqual(at(5, 0))
  })

  it('eats an item ahead, grows and keeps the items topped up', () => {
    const s = state([[7, 7], [7, 8], [7, 9]], 'up', [{ x: 7, y: 6, kind: '⭐' }, { x: 2, y: 2, kind: '💖' }])
    expect(step(s)).toBe('ate')
    expect(s.snake).toHaveLength(4)
    expect(s.collected).toBe(1)
    expect(s.items).toHaveLength(ITEMS_ON_FIELD)
    expect(s.items.some(i => i.x === 7 && i.y === 6)).toBe(false)
  })

  it('ends the round when the head hits the body', () => {
    // Head at (5,5) going down into (5,6), which is body
    const s = state([[5, 5], [6, 5], [6, 6], [5, 6], [4, 6]], 'down')
    expect(step(s)).toBe('crashed')
    expect(s.over).toBe(true)
  })

  it('lets the head follow into the cell the tail leaves', () => {
    // A 2x2 loop: the head moves into the tail's cell as the tail moves on
    const s = state([[5, 5], [6, 5], [6, 6], [5, 6]], 'down')
    expect(step(s)).toBeNull()
    expect(s.over).toBe(false)
  })
})

describe('spawnItem', () => {
  it('returns null when no cell is free', () => {
    const cells: number[][] = []
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push([x, y])
    const s = state(cells, 'up')
    expect(spawnItem(s, Math.random)).toBeNull()
  })

  it('finds the only free cell', () => {
    const cells: number[][] = []
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (x !== 3 || y !== 4) cells.push([x, y])
    const s = state(cells, 'up')
    expect(spawnItem(s, Math.random)).toMatchObject({ x: 3, y: 4 })
  })
})

describe('tickMs', () => {
  it('starts slow and speeds up a little per item down to a floor', () => {
    expect(tickMs(0)).toBe(260)
    expect(tickMs(10)).toBe(200)
    expect(tickMs(100)).toBe(140)
  })
})
