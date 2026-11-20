import { describe, expect, it, vi } from 'vitest'

// The window of every ladder made smaller than ten: the example must stop once the window is full, whatever its size
vi.mock('./ladders', async importOriginal => {
  const real = await importOriginal<typeof import('./ladders')>()
  const WINDOW = Object.fromEntries(Object.keys(real.WINDOW).map(l => [l, 8])) as typeof real.WINDOW
  return { ...real, WINDOW }
})

describe('the example before the first task', () => {
  it('stops once she has answered a full window at the step, whatever its size', async () => {
    const { exampleFor: rhymes } = await import('./rhymes')
    const { exampleFor: patterns } = await import('./patterns')
    const { exampleFor: kalender } = await import('./kalender')
    const { exampleFor: raum } = await import('./raum')
    const { exampleFor: rhythm } = await import('./rhythm')
    const today = new Date(2026, 10, 19)
    expect(rhymes(1, 7)).not.toBeNull()
    expect(rhymes(1, 8)).toBeNull()
    expect(patterns(1, 8)).toBeNull()
    expect(kalender(1, 8, today)).toBeNull()
    expect(raum(1, 8)).toBeNull()
    expect(rhythm(1, 8)).toBe(false)
  })
})
