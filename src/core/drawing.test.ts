import { describe, it, expect } from 'vitest'
import { TOOLS, SHAPES, SIZES, COLORS, strokeStyle, drawStroke, isShape, type Point, type Tool } from './drawing'

// Records what a stroke does to a canvas
type Call = [string, ...unknown[]]
function fakeCtx(): CanvasRenderingContext2D & { calls: Call[] } {
  const calls: Call[] = []
  const target: Record<string | symbol, unknown> = { calls }
  return new Proxy(target, {
    get: (t, k) => k in t ? t[k] : (...args: unknown[]) => calls.push([String(k), ...args]),
    set: (t, k, v) => { calls.push([`set ${String(k)}`, v]); t[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D & { calls: Call[] }
}

describe('tools', () => {
  it('has a brush, a pencil and an eraser in three sizes, and 12 colours', () => {
    expect(TOOLS).toEqual(['brush', 'pencil', 'eraser'])
    expect(SIZES).toEqual(['S', 'M', 'L'])
    expect(COLORS).toHaveLength(12)
    expect(new Set(COLORS).size).toBe(12)
  })

  it('gets wider with each size, for every tool', () => {
    for (const tool of TOOLS) {
      const [s, m, l] = SIZES.map(size => strokeStyle(tool, size, '#ff0000').width)
      expect(s).toBeLessThan(m)
      expect(m).toBeLessThan(l)
    }
  })

  it('draws the pencil thinner and lighter than the brush', () => {
    const brush  = strokeStyle('brush', 'M', '#ff0000')
    const pencil = strokeStyle('pencil', 'M', '#ff0000')
    expect(pencil.width).toBeLessThan(brush.width)
    expect(pencil.alpha).toBeLessThan(1)
    expect(brush.alpha).toBe(1)
    expect(brush.color).toBe('#ff0000')
  })

  it('erases with the paper colour, whatever colour is chosen', () => {
    expect(strokeStyle('eraser', 'M', '#ff0000').color).toBe('#ffffff')
  })
})

describe('drawStroke', () => {
  it('draws a line through the points in the tool style', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, { tool: 'brush', size: 'L', color: '#00ff00', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }] })
    expect(ctx.calls).toContainEqual(['set strokeStyle', '#00ff00'])
    expect(ctx.calls).toContainEqual(['set lineWidth', strokeStyle('brush', 'L', '#00ff00').width])
    expect(ctx.calls.some(c => c[0] === 'stroke')).toBe(true)
  })

  it('draws a dot for a single tap', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, { tool: 'pencil', size: 'S', color: '#0000ff', points: [{ x: 5, y: 5 }] })
    expect(ctx.calls.some(c => c[0] === 'arc')).toBe(true)
    expect(ctx.calls.some(c => c[0] === 'fill')).toBe(true)
  })

  it('leaves the canvas as it found it', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, { tool: 'pencil', size: 'M', color: '#0000ff', points: [{ x: 0, y: 0 }, { x: 9, y: 9 }] })
    expect(ctx.calls[0][0]).toBe('save')
    expect(ctx.calls.at(-1)?.[0]).toBe('restore')
  })

  it('ignores a stroke without points', () => {
    const ctx = fakeCtx()
    expect(() => drawStroke(ctx, { tool: 'brush', size: 'S', color: '#000000', points: [] })).not.toThrow()
    expect(ctx.calls).toEqual([])
  })
})

describe('shapes', () => {
  const shape = (tool: Tool, a: Point = { x: 10, y: 20 }, b: Point = { x: 110, y: 80 }) => ({ tool, size: 'M' as const, color: '#e53935', points: [a, b] })
  const called = (ctx: { calls: Call[] }, name: string) => ctx.calls.filter(c => c[0] === name)

  it('has a line, circle, rectangle, triangle, star and heart', () => {
    expect(SHAPES).toEqual(['line', 'circle', 'rect', 'triangle', 'star', 'heart'])
    for (const s of SHAPES) expect(isShape(s)).toBe(true)
    for (const t of TOOLS) expect(isShape(t)).toBe(false)
  })

  it('draws shapes as outlines as wide as the brush', () => {
    for (const s of SHAPES) {
      expect(strokeStyle(s, 'L', '#e53935')).toEqual(strokeStyle('brush', 'L', '#e53935'))
      const ctx = fakeCtx()
      drawStroke(ctx, shape(s))
      expect(called(ctx, 'stroke'), s).toHaveLength(1)
      expect(called(ctx, 'fill'), s).toHaveLength(0)
    }
  })

  it('draws a straight line from start to end', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, shape('line'))
    expect(called(ctx, 'moveTo')).toEqual([['moveTo', 10, 20]])
    expect(called(ctx, 'lineTo')).toEqual([['lineTo', 110, 80]])
  })

  it('fits the circle into the dragged box, whichever way it was dragged', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, shape('circle', { x: 110, y: 80 }, { x: 10, y: 20 }))
    expect(called(ctx, 'ellipse')[0].slice(1, 5)).toEqual([60, 50, 50, 30])
  })

  it('draws the rectangle over the dragged box', () => {
    const ctx = fakeCtx()
    drawStroke(ctx, shape('rect', { x: 110, y: 80 }, { x: 10, y: 20 }))
    expect(called(ctx, 'rect')).toEqual([['rect', 10, 20, 100, 60]])
  })

  it('closes the triangle and the star', () => {
    for (const s of ['triangle', 'star'] as const) {
      const ctx = fakeCtx()
      drawStroke(ctx, shape(s))
      expect(called(ctx, 'closePath'), s).toHaveLength(1)
    }
    const star = fakeCtx()
    drawStroke(star, shape('star'))
    expect(called(star, 'lineTo')).toHaveLength(9)   // 10 corners
  })
})
