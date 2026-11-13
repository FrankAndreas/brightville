import { describe, expect, it } from 'vitest'
import { BODY_COLORS, DEFAULT_LOOK, GLASSES, HAIR_COLORS, HAIR_STYLES, isLook, randomLook } from './look'

describe('her look', () => {
  it('offers the same choices the server takes (backend/app/wardrobe.py LOOK_OPTIONS)', () => {
    expect(BODY_COLORS).toEqual(['#ff9a3c', '#4f8fe8', '#4bd37b', '#e86fb0', '#a58bf0', '#f2c230', '#3cc8c8', '#ff6b6b'])
    expect(HAIR_STYLES).toEqual(['none', 'spiky', 'ponytail', 'buns', 'curly'])
    expect(HAIR_COLORS).toEqual(['#6b3b1f', '#222222', '#f2c94c', '#d4572a', '#4f8fe8', '#ff8fc8'])
    expect(GLASSES).toEqual(['none', 'round', 'star', 'heart'])
  })

  it('starts as today\'s orange blob: no hair, no glasses', () => {
    expect(DEFAULT_LOOK).toEqual({ body: '#ff9a3c', hair: 'none', hairColor: '#6b3b1f', glasses: 'none' })
    expect(isLook(DEFAULT_LOOK)).toBe(true)
  })

  it('tells a look from anything else', () => {
    expect(isLook({ ...DEFAULT_LOOK, hair: 'mohawk' })).toBe(false)
    expect(isLook({ ...DEFAULT_LOOK, extra: 1 })).toBe(false)
    expect(isLook(null)).toBe(false)
    expect(isLook({ body: '#ff9a3c' })).toBe(false)
  })

  it('picks a random look from the lists', () => {
    expect(randomLook(() => 0)).toEqual({ body: BODY_COLORS[0], hair: HAIR_STYLES[0], hairColor: HAIR_COLORS[0], glasses: GLASSES[0] })
    const last = randomLook(() => 0.999)
    expect(last).toEqual({ body: BODY_COLORS.at(-1), hair: HAIR_STYLES.at(-1), hairColor: HAIR_COLORS.at(-1), glasses: GLASSES.at(-1) })
  })
})
