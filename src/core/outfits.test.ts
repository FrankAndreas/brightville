import { describe, expect, it } from 'vitest'
import stickers from '../../shared/stickers.json'
import { OUTFITS, PLACES, giftFor, outfitDef, pay, shelfOpen, shopMoney } from './outfits'

// The same cases as tests/test_outfit_rules.py: page and server must agree
const RANGES = { 1: [15, 25], 2: [40, 60], 3: [90, 120] } as const

describe('the outfit catalogue', () => {
  it('prices every sold add-on within its shelf, and gives every gift for an existing sticker', () => {
    const stickerIds = stickers.map(s => s.id)
    for (const o of OUTFITS) {
      expect(PLACES, o.id).toContain(o.place)
      if (o.sticker) {
        expect(stickerIds, o.id).toContain(o.sticker)
        expect(o.price, o.id).toBeUndefined()
        expect(o.shelf, o.id).toBeUndefined()
      } else {
        const [low, high] = RANGES[o.shelf!]
        expect(o.price, o.id).toBeGreaterThanOrEqual(low)
        expect(o.price, o.id).toBeLessThanOrEqual(high)
      }
    }
    expect(OUTFITS.filter(o => !o.sticker)).toHaveLength(15)
    expect(giftFor('sternensammler')?.id).toBe('glitzerband')
    expect(outfitDef('krone')?.place).toBe('head')
    expect(outfitDef('gibtsnicht')).toBeUndefined()
  })

  it('opens a shelf once two add-ons from the shelf above are owned; gifts do not count', () => {
    expect(shelfOpen(1, [])).toBe(true)
    expect(shelfOpen(2, ['schleife'])).toBe(false)
    expect(shelfOpen(2, ['schleife', 'kappe'])).toBe(true)
    expect(shelfOpen(2, ['schleife', 'glitzerband'])).toBe(false)
    expect(shelfOpen(3, ['schleife', 'kappe'])).toBe(false)
    expect(shelfOpen(3, ['schleife', 'kappe', 'kleid', 'umhang'])).toBe(true)
  })

  it('counts saved Stars half in the shop', () => {
    expect(shopMoney(90, 60)).toBe(60)
    expect(shopMoney(10, 0)).toBe(10)
    expect(shopMoney(1, 1)).toBe(0)
  })

  it('pays from the savings first, two for one, then from new Stars', () => {
    expect(pay(20, 90, 60)).toEqual({ stars: 50, savings: 20 })
    expect(pay(20, 21, 1)).toEqual({ stars: 1, savings: 1 })
    expect(pay(20, 19, 0)).toBeNull()
    expect(pay(100, 150, 150)).toBeNull()
    expect(pay(20, 40, 30)).toEqual({ stars: 5, savings: 0 })
  })
})
