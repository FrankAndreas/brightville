import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keyboardIntents, type IntentSource } from './intents'

const down = (code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat, cancelable: true }))
const up = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

describe('keyboardIntents', () => {
  let source: IntentSource
  beforeEach(() => { source = keyboardIntents() })
  afterEach(() => source.dispose())

  it('is at rest with no keys', () => {
    expect(source.read()).toEqual({ moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false })
  })

  it('maps arrows and WASD to a move vector', () => {
    down('ArrowLeft')
    expect(source.read().moveX).toBe(-1)
    up('ArrowLeft')
    down('KeyD')
    expect(source.read().moveX).toBe(1)
    up('KeyD')
    down('ArrowUp')
    expect(source.read().moveZ).toBe(-1)
    up('ArrowUp')
    down('KeyS')
    expect(source.read().moveZ).toBe(1)
    up('KeyS')
    expect(source.read()).toMatchObject({ moveX: 0, moveZ: 0 })
  })

  it('cancels opposite keys', () => {
    down('ArrowLeft')
    down('ArrowRight')
    expect(source.read().moveX).toBe(0)
  })

  it('reports jump once per press, not while held', () => {
    down('Space')
    expect(source.read().jump).toBe(true)
    expect(source.read().jump).toBe(false)
    down('Space', true)
    expect(source.read().jump).toBe(false)
    up('Space')
    down('Space')
    expect(source.read().jump).toBe(true)
  })

  it('reports interact for Enter and for KeyE', () => {
    down('Enter')
    expect(source.read().interact).toBe(true)
    expect(source.read().interact).toBe(false)
    down('KeyE')
    expect(source.read().interact).toBe(true)
  })

  it('reports leave for Escape', () => {
    down('Escape')
    expect(source.read().leave).toBe(true)
    expect(source.read().leave).toBe(false)
  })

  it('forgets held keys when the window loses focus', () => {
    down('ArrowLeft')
    down('Space')
    window.dispatchEvent(new Event('blur'))
    expect(source.read()).toMatchObject({ moveX: 0, jump: false })
  })

  it('forgets held keys when the page is hidden', () => {
    down('ArrowLeft')
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    expect(source.read().moveX).toBe(0)
  })

  it('keeps the page from scrolling on arrows and Space', () => {
    const e = new KeyboardEvent('keydown', { code: 'ArrowDown', cancelable: true })
    window.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    const other = new KeyboardEvent('keydown', { code: 'KeyP', cancelable: true })
    window.dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
  })

  it('reset lets go of everything but keeps listening', () => {
    down('ArrowLeft')
    down('Enter')
    source.reset()
    expect(source.read()).toMatchObject({ moveX: 0, interact: false })
    down('ArrowRight')
    expect(source.read().moveX).toBe(1)
  })

  it('stops listening after dispose', () => {
    source.dispose()
    down('ArrowLeft')
    down('Space')
    expect(source.read()).toMatchObject({ moveX: 0, jump: false })
  })

  it('turns the view with J and L while held, turns around with K and looks back with I, once per press', () => {
    const k = keyboardIntents()
    down('KeyJ')
    expect(k.read().turn).toBe(-1)
    up('KeyJ')
    down('KeyL')
    expect(k.read().turn).toBe(1)
    down('KeyJ')
    expect(k.read().turn).toBe(0)
    up('KeyJ')
    up('KeyL')
    down('KeyK')
    down('KeyI')
    expect(k.read()).toMatchObject({ turn: 0, turnAround: true, lookHome: true })
    expect(k.read()).toMatchObject({ turnAround: false, lookHome: false })
    k.dispose()
  })
})
