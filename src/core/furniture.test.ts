import { describe, expect, it } from 'vitest'
import { OUTFITS, shelfOpen } from './outfits'
import { FURNITURE, SPOTS, furnitureDef, furnitureShelfOpen } from './furniture'

// The same cases as tests/test_furniture_rules.py
const RANGES = { 1: [15, 25], 2: [40, 60], 3: [90, 120] } as const

describe('the furniture catalogue', () => {
  it('puts every piece on a known spot, priced within its shelf, six to a shelf', () => {
    for (const f of FURNITURE) {
      expect(SPOTS, f.id).toContain(f.spot)
      const [low, high] = RANGES[f.shelf]
      expect(f.price, f.id).toBeGreaterThanOrEqual(low)
      expect(f.price, f.id).toBeLessThanOrEqual(high)
    }
    for (const shelf of [1, 2, 3]) expect(FURNITURE.filter(f => f.shelf === shelf)).toHaveLength(6)
    expect(furnitureDef('holzbett')?.spot).toBe('bett')
    expect(furnitureDef('gibtsnicht')).toBeUndefined()
  })

  it('never uses an id the clothes use', () => {
    const clothes = new Set(OUTFITS.map(o => o.id))
    for (const f of FURNITURE) expect(clothes.has(f.id), f.id).toBe(false)
  })

  it('opens its shelves with two pieces from above; clothes don\'t count', () => {
    expect(furnitureShelfOpen(1, [])).toBe(true)
    expect(furnitureShelfOpen(2, ['sonnenbild'])).toBe(false)
    expect(furnitureShelfOpen(2, ['sonnenbild', 'kaktus'])).toBe(true)
    expect(furnitureShelfOpen(2, ['sonnenbild', 'schal'])).toBe(false)
    expect(furnitureShelfOpen(3, ['sonnenbild', 'kaktus', 'einhornbild', 'zeltbett'])).toBe(true)
    // and furniture doesn't open clothes shelves
    expect(shelfOpen(2, ['sonnenbild', 'kaktus'])).toBe(false)
  })
})
