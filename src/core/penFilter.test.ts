import { describe, it, expect } from 'vitest'
import { createPenFilter, penStart, penEnd } from './penFilter'

describe('penFilter', () => {
  it('follows one touch at a time', () => {
    const f = createPenFilter()
    expect(penStart(f, 1, 10)).toBe(true)
    expect(penStart(f, 2, 10)).toBe(false)
    expect(f.pen).toBe(1)
    expect(penEnd(f, 2)).toBe(false)
    expect(penEnd(f, 1)).toBe(true)
    expect(penStart(f, 2, 10)).toBe(true)
  })

  it('ignores a touch much bigger than the pen, like a resting hand', () => {
    const f = createPenFilter()
    penStart(f, 1, 41.6)
    penEnd(f, 1)
    expect(penStart(f, 2, 125)).toBe(false)
    expect(penStart(f, 3, 62.4)).toBe(true)
  })

  it('takes touches whose size the browser does not report', () => {
    const f = createPenFilter()
    expect(penStart(f, 1, 0)).toBe(true)
  })
})
