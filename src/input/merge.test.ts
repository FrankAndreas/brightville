import { describe, expect, it, vi } from 'vitest'
import type { IntentSource, Intents } from './intents'
import { mergeIntents } from './merge'
import { touchIntents } from './touch'

const fixed = (i: Partial<Intents>): IntentSource => ({
  read: () => ({ moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false, ...i }),
  reset: vi.fn(),
  dispose: vi.fn(),
})

describe('mergeIntents', () => {
  it('adds the movement of all sources, never beyond full speed', () => {
    const merged = mergeIntents(fixed({ moveX: 1, moveZ: -0.3 }), fixed({ moveX: 0.8, moveZ: -0.3 }))
    expect(merged.read()).toMatchObject({ moveX: 1, moveZ: -0.6 })
    expect(mergeIntents(fixed({ moveX: -1 }), fixed({ moveX: -1 })).read().moveX).toBe(-1)
  })

  it('takes a press from any source, once', () => {
    const touch = touchIntents()
    const merged = mergeIntents(fixed({}), touch)
    touch.press('jump')
    expect(merged.read()).toMatchObject({ jump: true, interact: false, leave: false })
    expect(merged.read().jump).toBe(false)
  })

  it('reads every source each time, so no press waits for later', () => {
    const a = touchIntents()
    const b = touchIntents()
    const merged = mergeIntents(a, b)
    a.press('interact')
    b.press('interact')
    expect(merged.read().interact).toBe(true)
    expect(merged.read().interact).toBe(false)
  })

  it('passes reset and dispose on to all', () => {
    const a = fixed({})
    const b = fixed({})
    const merged = mergeIntents(a, b)
    merged.reset()
    merged.dispose()
    for (const s of [a, b]) {
      expect(s.reset).toHaveBeenCalledTimes(1)
      expect(s.dispose).toHaveBeenCalledTimes(1)
    }
  })

  it('adds turning, and takes a turn-around or look-back from any source once', () => {
    const touch = touchIntents()
    const merged = mergeIntents(fixed({ turn: 1 }), touch)
    touch.setTurn(1)
    expect(merged.read().turn).toBe(1)
    touch.setTurn(-1)
    expect(merged.read().turn).toBe(0)
    touch.press('turnAround')
    expect(merged.read()).toMatchObject({ turnAround: true, lookHome: false })
    expect(merged.read().turnAround).toBe(false)
  })
})
