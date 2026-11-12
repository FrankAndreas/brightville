import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { buildDeck, createMemory, pickPairs, type Card, type Pair } from './memory'

const pairs: Pair[] = [
  { id: 'cat', emoji: '🐱', say: 'Katze' },
  { id: 'dog', emoji: '🐶', say: 'Hund' },
  { id: 'cow', emoji: '🐮', say: 'Kuh' },
  { id: 'pig', emoji: '🐷', say: 'Schwein' },
]
/** A deck in a known order: cat-a, cat-b, dog-a, dog-b */
const deck: Card[] = pairs.slice(0, 2).flatMap(p => [{ ...p, key: `${p.id}-a` }, { ...p, key: `${p.id}-b` }])

describe('pickPairs', () => {
  it('picks the asked number of different pairs', () => {
    const picked = pickPairs(pairs, 3, seededRandom(1))
    expect(picked).toHaveLength(3)
    expect(new Set(picked.map(p => p.id)).size).toBe(3)
  })

  it('does not always pick the first ones', () => {
    const firsts = new Set(Array.from({ length: 30 }, (_, seed) => pickPairs(pairs, 1, seededRandom(seed))[0].id))
    expect(firsts.size).toBeGreaterThan(1)
  })
})

describe('buildDeck', () => {
  it('has every pair twice under different keys', () => {
    const cards = buildDeck(pairs, seededRandom(3))
    expect(cards).toHaveLength(8)
    expect(new Set(cards.map(c => c.key)).size).toBe(8)
    for (const p of pairs) expect(cards.filter(c => c.id === p.id)).toHaveLength(2)
  })

  it('shuffles', () => {
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => buildDeck(pairs, seededRandom(seed)).map(c => c.key).join()))
    expect(orders.size).toBeGreaterThan(10)
  })
})

describe('createMemory', () => {
  it('starts with everything face down', () => {
    const game = createMemory(deck)
    expect(game.open).toEqual([])
    expect(game.matched).toEqual([])
    expect(game.done).toBe(false)
  })

  it('keeps a pair open', () => {
    const game = createMemory(deck)
    expect(game.flip('cat-a')).toBe('first')
    expect(game.open).toEqual(['cat-a'])
    expect(game.flip('cat-b')).toBe('match')
    expect(game.open).toEqual([])
    expect(game.matched).toEqual(['cat-a', 'cat-b'])
  })

  it('shows two different cards until they are hidden again', () => {
    const game = createMemory(deck)
    game.flip('cat-a')
    expect(game.flip('dog-a')).toBe('miss')
    expect(game.open).toEqual(['cat-a', 'dog-a'])
    expect(game.flip('dog-b')).toBe('ignored')
    game.hideMisses()
    expect(game.open).toEqual([])
    expect(game.flip('dog-b')).toBe('first')
  })

  it('ignores a card that is already face up, found, or unknown', () => {
    const game = createMemory(deck)
    game.flip('cat-a')
    expect(game.flip('cat-a')).toBe('ignored')
    game.flip('cat-b')
    expect(game.flip('cat-a')).toBe('ignored')
    expect(game.flip('nope')).toBe('ignored')
    expect(game.open).toEqual([])
  })

  it('hideMisses leaves a single open card alone', () => {
    const game = createMemory(deck)
    game.flip('cat-a')
    game.hideMisses()
    expect(game.open).toEqual(['cat-a'])
  })

  it('is done when every pair is found', () => {
    const game = createMemory(deck)
    game.flip('cat-a'); game.flip('cat-b'); game.flip('dog-b')
    expect(game.done).toBe(false)
    game.flip('dog-a')
    expect(game.done).toBe(true)
  })
})
