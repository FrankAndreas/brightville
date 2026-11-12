import { describe, expect, it } from 'vitest'
import { touchIntents } from './touch'

describe('touchIntents', () => {
  it('is at rest at first', () => {
    expect(touchIntents().read()).toEqual({ moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false })
  })

  it('reports the stick until it changes', () => {
    const t = touchIntents()
    t.setStick(0.4, -1)
    expect(t.read()).toMatchObject({ moveX: 0.4, moveZ: -1 })
    expect(t.read()).toMatchObject({ moveX: 0.4, moveZ: -1 })
    t.setStick(0, 0)
    expect(t.read()).toMatchObject({ moveX: 0, moveZ: 0 })
  })

  it('reports a press in exactly one read', () => {
    const t = touchIntents()
    t.press('jump')
    t.press('jump')
    expect(t.read().jump).toBe(true)
    expect(t.read().jump).toBe(false)
    t.press('interact')
    t.press('leave')
    expect(t.read()).toMatchObject({ interact: true, leave: true, jump: false })
  })

  it('centres the stick and forgets presses on reset and dispose', () => {
    const t = touchIntents()
    t.setStick(1, 1)
    t.press('jump')
    t.reset()
    expect(t.read()).toEqual({ moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false })
    t.setStick(1, 1)
    t.dispose()
    expect(t.read()).toMatchObject({ moveX: 0, moveZ: 0 })
  })

  it('turns while a turn button is held, and stops on reset', () => {
    const t = touchIntents()
    t.setTurn(-1)
    expect(t.read().turn).toBe(-1)
    expect(t.read().turn).toBe(-1)
    t.reset()
    expect(t.read().turn).toBe(0)
  })
})
