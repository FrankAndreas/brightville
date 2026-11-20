import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { pick, shuffle } from './random'

describe('the shared random helpers', () => {
  it('picks one of the items', () => {
    const items = ['a', 'b', 'c']
    for (let seed = 0; seed < 20; seed++) expect(items).toContain(pick(items, seededRandom(seed)))
    expect(pick(items, () => 0)).toBe('a')
    expect(pick(items, () => 0.999)).toBe('c')
  })

  it('shuffles into a new list with the same items, the same way for the same seed, leaving the old one alone', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const once = shuffle(items, seededRandom(7))
    expect([...once].sort()).toEqual(items)
    expect(shuffle(items, seededRandom(7))).toEqual(once)
    expect(items).toEqual([1, 2, 3, 4, 5, 6])
    // Fisher–Yates from the end, as every copy did: with random() always 0, each item swaps with the first
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1])
  })
})
