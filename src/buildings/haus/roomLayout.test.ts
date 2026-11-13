import { describe, expect, it } from 'vitest'
import { SPOTS } from '@/core/furniture'
import { SPOT_RECTS, WINDOW_RECT } from './roomLayout'

type Rect = [number, number, number, number]
const apart = ([l1, t1, w1, h1]: Rect, [l2, t2, w2, h2]: Rect) =>
  l1 + w1 <= l2 || l2 + w2 <= l1 || t1 + h1 <= t2 || t2 + h2 <= t1

describe('the room\'s layout', () => {
  it('has a place for every spot, inside the room', () => {
    for (const spot of SPOTS) {
      const [left, top, width, height] = SPOT_RECTS[spot]
      expect(left >= 0 && top >= 0 && left + width <= 100 && top + height <= 100, spot).toBe(true)
    }
  })

  it('keeps the spots apart: a tap on one never lands on another', () => {
    for (const a of SPOTS) for (const b of SPOTS) if (a !== b) expect(apart(SPOT_RECTS[a], SPOT_RECTS[b]), `${a} / ${b}`).toBe(true)
  })

  it('keeps every spot off the window, except the curtain above it', () => {
    for (const spot of SPOTS) if (spot !== 'vorhang') expect(apart(SPOT_RECTS[spot], WINDOW_RECT), spot).toBe(true)
  })

  it('keeps the curtain right of the leave and 🔊 buttons on the narrowest upright iPad (768 px)', () => {
    // The 🔊 button ends 172 px from the left edge, safe areas aside
    expect(SPOT_RECTS.vorhang[0]).toBeGreaterThanOrEqual((172 / 768) * 100 + 1)
  })
})
