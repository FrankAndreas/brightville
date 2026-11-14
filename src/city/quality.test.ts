import { describe, expect, it } from 'vitest'
import { SLOW_FRAME_MS, nextPixelRatio } from './quality'

describe('nextPixelRatio', () => {
  it('keeps the pixel ratio while frames are quick', () => {
    expect(nextPixelRatio(2, 16, 2)).toBe(2)
  })

  it('drops to 1.5 when frames are slow, then 1, and never below 1', () => {
    expect(nextPixelRatio(2, SLOW_FRAME_MS + 3, 2)).toBe(1.5)
    expect(nextPixelRatio(1.5, SLOW_FRAME_MS + 3, 2)).toBe(1)
    expect(nextPixelRatio(1, 60, 2)).toBe(1)
  })

  it('never rises again during a visit', () => {
    expect(nextPixelRatio(1, 10, 2)).toBe(1)
  })

  it('never goes above the device', () => {
    expect(nextPixelRatio(2, 10, 1.5)).toBe(1.5)
  })
})
