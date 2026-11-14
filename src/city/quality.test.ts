import { describe, expect, it } from 'vitest'
import { SLOW_FRAME_MS, createSpeedWatch, nextPixelRatio } from './quality'

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

describe('createSpeedWatch', () => {
  const frames = (watch: ReturnType<typeof createSpeedWatch>, from: number, count: number, ms: number) => {
    let ratio: number | null = null
    for (let i = 1; i <= count; i++) ratio = watch.frame(from + i * ms) ?? ratio
    return ratio
  }

  it('drops the pixel ratio after two seconds of slow frames', () => {
    const watch = createSpeedWatch(2)
    watch.frame(0)
    expect(frames(watch, 0, 80, 30)).toBe(1.5)
  })

  it('keeps it with quick frames', () => {
    const watch = createSpeedWatch(2)
    watch.frame(0)
    expect(frames(watch, 0, 200, 16)).toBeNull()
  })

  it('doesn\'t count a pause (a locked iPad, another app) as a slow frame', () => {
    const watch = createSpeedWatch(2)
    watch.frame(0)
    frames(watch, 0, 60, 16)
    // A minute away, then quick frames again
    expect(watch.frame(60_000 + 1000)).toBeNull()
    expect(frames(watch, 61_000, 200, 16)).toBeNull()
  })

  it('starts measuring after the first frame, so building the shaders doesn\'t count', () => {
    const watch = createSpeedWatch(2)
    // The first frame takes long, the rest are quick
    watch.frame(0)
    watch.frame(900)
    expect(frames(watch, 900, 150, 16)).toBeNull()
  })
})
