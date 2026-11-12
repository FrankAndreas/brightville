import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keyboardIntents, type Intents, type IntentSource } from '@/input/intents'
import { createLoop } from './loop'

const down = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('createLoop', () => {
  let intents: IntentSource
  let steps: { intents: Intents; dt: number }[]
  const start = () => createLoop(intents, (i, dt) => steps.push({ intents: i, dt }))

  beforeEach(() => {
    vi.useFakeTimers()
    intents = keyboardIntents()
    steps = []
  })
  afterEach(() => {
    intents.dispose()
    vi.useRealTimers()
  })

  it('steps once per frame with the frame time in seconds', async () => {
    const loop = start()
    loop.resume()
    await vi.advanceTimersByTimeAsync(100)
    expect(steps.length).toBeGreaterThanOrEqual(5)
    expect(steps.at(-1)!.dt).toBeCloseTo(0.016, 3)
    loop.pause()
  })

  it('does not step while paused', async () => {
    const loop = start()
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    loop.pause()
    const count = steps.length
    await vi.advanceTimersByTimeAsync(500)
    expect(steps.length).toBe(count)
  })

  it('never passes more than 0.05 s, even after a long stall', async () => {
    const loop = start()
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    loop.pause()
    await vi.advanceTimersByTimeAsync(10000)
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    expect(Math.max(...steps.map(s => s.dt))).toBeLessThanOrEqual(0.05)
  })

  it('drops presses made while paused', async () => {
    const loop = start()
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    loop.pause()
    // e.g. the Enter that leaves a building must not walk straight back in
    down('Enter')
    down('Space')
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    expect(steps.some(s => s.intents.interact || s.intents.jump)).toBe(false)
    loop.pause()
  })

  it('still sees presses made while running', async () => {
    const loop = start()
    loop.resume()
    await vi.advanceTimersByTimeAsync(50)
    down('Enter')
    await vi.advanceTimersByTimeAsync(50)
    expect(steps.filter(s => s.intents.interact)).toHaveLength(1)
    loop.pause()
  })

  it('stays stopped after stop()', async () => {
    const loop = start()
    loop.stop()
    loop.resume()
    await vi.advanceTimersByTimeAsync(100)
    expect(steps).toEqual([])
  })
})
