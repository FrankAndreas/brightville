import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectDevice } from './device'

function stub(opts: { getUserMedia?: boolean; touchPoints?: number; hover?: boolean }) {
  vi.stubGlobal('navigator', {
    mediaDevices: opts.getUserMedia ? { getUserMedia: () => Promise.reject(new Error('unused')) } : undefined,
    maxTouchPoints: opts.touchPoints ?? 0,
  })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(any-hover: hover)' && !!opts.hover }))
}

describe('detectDevice', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sees a laptop with a webcam', () => {
    stub({ getUserMedia: true, touchPoints: 0, hover: true })
    expect(detectDevice()).toEqual({ camera: true, touch: false, keyboard: true })
  })

  it('sees a tablet', () => {
    stub({ getUserMedia: true, touchPoints: 5, hover: false })
    expect(detectDevice()).toEqual({ camera: true, touch: true, keyboard: false })
  })

  it('sees no camera on an insecure page', () => {
    stub({ getUserMedia: false, hover: true })
    expect(detectDevice().camera).toBe(false)
  })

  it('survives a browser without matchMedia', () => {
    stub({ getUserMedia: true })
    vi.stubGlobal('matchMedia', undefined)
    expect(detectDevice().keyboard).toBe(false)
  })
})
