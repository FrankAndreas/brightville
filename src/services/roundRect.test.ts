import { describe, it, expect, vi } from 'vitest'
import { fillRoundRect } from './roundRect'

const fakeCtx = (extra: Record<string, unknown> = {}) => ({
  beginPath: vi.fn(), moveTo: vi.fn(), arcTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
  ...extra,
})

describe('fillRoundRect', () => {
  it('uses the native roundRect where the browser has it', () => {
    const roundRect = vi.fn()
    const ctx = fakeCtx({ roundRect })
    fillRoundRect(ctx as unknown as CanvasRenderingContext2D, 1, 2, 30, 40, 5)
    expect(roundRect).toHaveBeenCalledWith(1, 2, 30, 40, 5)
    expect(ctx.fill).toHaveBeenCalledOnce()
  })

  it('draws the corners itself on older Safari without roundRect', () => {
    const ctx = fakeCtx()
    expect(() => fillRoundRect(ctx as unknown as CanvasRenderingContext2D, 1, 2, 30, 40, 5)).not.toThrow()
    expect(ctx.arcTo).toHaveBeenCalledTimes(4)
    expect(ctx.fill).toHaveBeenCalledOnce()
  })
})
