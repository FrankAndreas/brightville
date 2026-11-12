import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useGameLoop } from './gameLoop'

describe('useGameLoop', () => {
  let frames: FrameRequestCallback[]
  let loop: ReturnType<typeof useGameLoop>
  let dts: number[]
  let wrapper: VueWrapper | null

  // Runs the next scheduled animation frame at time t
  const tick = (t: number) => { const cb = frames.shift(); if (cb) cb(t) }

  function mountLoop() {
    dts = []
    wrapper = mount(defineComponent({
      setup() {
        loop = useGameLoop(dt => dts.push(dt))
        return () => h('div')
      },
    }))
    return wrapper
  }

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => { frames = [] })
    setHidden(false)
  })

  afterEach(() => wrapper?.unmount())

  it('passes the time between frames', () => {
    mountLoop()
    loop.start()
    tick(1000)
    tick(1016)
    tick(1050)
    expect(dts).toEqual([0, 16, 34])
  })

  it('caps a long gap at 100 ms', () => {
    mountLoop()
    loop.start()
    tick(1000)
    tick(6000)
    expect(dts).toEqual([0, 100])
  })

  it('pauses while the page is hidden and resumes without a jump', () => {
    mountLoop()
    loop.start()
    tick(1000)
    setHidden(true)
    expect(loop.running.value).toBe(false)
    tick(2000)
    setHidden(false)
    expect(loop.running.value).toBe(true)
    tick(30000)
    tick(30016)
    expect(dts).toEqual([0, 0, 16])
  })

  it('stays stopped when the page shows again after a stop', () => {
    mountLoop()
    loop.start()
    loop.stop()
    setHidden(true)
    setHidden(false)
    expect(loop.running.value).toBe(false)
  })

  it('stops when the component unmounts', () => {
    mountLoop()
    loop.start()
    wrapper?.unmount()
    expect(loop.running.value).toBe(false)
    wrapper = null
  })
})
