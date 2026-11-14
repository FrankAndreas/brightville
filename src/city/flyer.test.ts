import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK } from '@/core/look'

// No WebGL in tests: a stand-in renderer that records what the flyer does with it
const renderer = vi.hoisted(() => ({ setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() }))
vi.mock('three', async importOriginal => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: vi.fn(function () { return renderer }) }))

import { createFlyer, flyingDress } from './flyer'

describe('the flying wobbly', () => {
  it('wears what she wears, but its wings instead of anything on the back', () => {
    const dress = { look: DEFAULT_LOOK, worn: { head: 'krone', back: 'rucksack' } }
    expect(flyingDress(dress)).toEqual({ look: DEFAULT_LOOK, worn: { head: 'krone' } })
    // Her dress itself is left as it was
    expect(dress.worn.back).toBe('rucksack')
  })

  it('beats its wings hard after a flap, and holds them still while gliding', () => {
    const flyer = createFlyer(document.createElement('canvas'))
    const angles = () => flyer.wings.map(w => w.rotation.z)
    const sweep = (frames: number) => {
      const seen: number[] = []
      for (let i = 0; i < frames; i++) {
        flyer.draw(0, 16)
        seen.push(angles()[1])
      }
      return Math.max(...seen) - Math.min(...seen)
    }
    // Long after a flap: gliding
    sweep(120)
    const gliding = sweep(20)
    flyer.flap()
    const beating = sweep(20)
    expect(flyer.wings).toHaveLength(2)
    expect(beating).toBeGreaterThan(gliding + 0.5)
    // The wings mirror each other
    expect(angles()[0]).toBeCloseTo(-angles()[1])
    flyer.dispose()
  })

  it('gives its WebGL context back when it goes', () => {
    const flyer = createFlyer(document.createElement('canvas'))
    flyer.dispose()
    expect(renderer.forceContextLoss).toHaveBeenCalled()
  })
})
