import { describe, expect, it } from 'vitest'
import stickers from '../../shared/stickers.json'
import { OUTFITS, PLACES, forLevel, giftFor, levelOf, outfitDef, pay, shelfOpen, shopMoney } from './outfits'

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
    expect(OUTFITS.filter(o => !o.sticker && levelOf(o) === 'kindergarten')).toHaveLength(15)
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

  it('his own range at Oberstufe: eleven items with their English and French names', () => {
    const his = OUTFITS.filter(o => o.level === 'oberstufe')
    expect(his.map(o => [o.id, o.name, o.article, o.en, o.fr, o.emoji, o.place, o.shelf, o.price])).toEqual([
      ['baseballkappe', 'Baseballkappe', 'die', 'cap', 'la casquette', '🧢', 'head', 1, 20],
      ['muetze', 'Mütze', 'die', 'beanie', 'le bonnet', '🧶', 'head', 1, 15],
      ['fanschal', 'Fanschal', 'der', 'scarf', 'l’écharpe', '🧣', 'neck', 1, 20],
      ['hoodie', 'Hoodie', 'der', 'hoodie', 'le sweat à capuche', '👕', 'body', 1, 25],
      ['sportrucksack', 'Rucksack', 'der', 'backpack', 'le sac à dos', '🎒', 'back', 1, 25],
      ['kopfhoerer', 'Kopfhörer', 'pl', 'headphones', 'le casque', '🎧', 'head', 2, 45],
      ['fussballtrikot', 'Fussballtrikot', 'das', 'football shirt', 'le maillot de foot', '⚽', 'body', 2, 50],
      ['jacke', 'Jacke', 'die', 'jacket', 'la veste', '🧥', 'body', 2, 55],
      ['skateboard', 'Skateboard', 'das', 'skateboard', 'le skateboard', '🛹', 'back', 2, 60],
      ['sportmedaille', 'Sportmedaille', 'die', 'medal', 'la médaille', '🥇', 'neck', 3, 90],
      ['gitarre', 'Gitarre', 'die', 'guitar', 'la guitare', '🎸', 'back', 3, 110],
    ])
    expect(new Set(OUTFITS.map(o => o.id)).size).toBe(OUTFITS.length)
    expect(OUTFITS.filter(o => !o.level).every(o => o.en === undefined && o.fr === undefined)).toBe(true)
    expect(OUTFITS.filter(o => o.sticker)).toHaveLength(4)
  })

  it('each level sees its own sold items, and only its own count for a shelf', () => {
    expect(forLevel('kindergarten').map(o => o.id)).toHaveLength(15)
    expect(forLevel('kindergarten').every(o => !o.level && o.price)).toBe(true)
    expect(forLevel('oberstufe')).toHaveLength(11)
    expect(shelfOpen(2, ['kappe', 'schal'], 'oberstufe')).toBe(false)
    expect(shelfOpen(2, ['baseballkappe', 'hoodie'], 'oberstufe')).toBe(true)
    expect(shelfOpen(2, ['baseballkappe', 'hoodie'])).toBe(false)
    expect(shelfOpen(3, ['kopfhoerer', 'jacke'], 'oberstufe')).toBe(true)
  })

  it('counts saved Stars half in the shop', () => {
    expect(shopMoney(90, 60)).toBe(60)
    expect(shopMoney(10, 0)).toBe(10)
    expect(shopMoney(1, 1)).toBe(1)
    // A lone saved Star left over counts like a new one: it isn't worth nothing for good
    expect(shopMoney(21, 1)).toBe(21)
  })

  it('pays from the savings first, two for one, then from new Stars', () => {
    expect(pay(20, 90, 60)).toEqual({ stars: 50, savings: 20 })
    expect(pay(20, 21, 1)).toEqual({ stars: 1, savings: 0 })
    expect(pay(20, 41, 21)).toEqual({ stars: 11, savings: 0 })
    expect(pay(20, 19, 0)).toBeNull()
    expect(pay(100, 150, 150)).toBeNull()
    expect(pay(20, 40, 30)).toEqual({ stars: 5, savings: 0 })
  })
})
