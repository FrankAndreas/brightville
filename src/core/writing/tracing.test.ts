import { describe, it, expect } from 'vitest'
import { GLYPHS } from './letters'
import { createTracer, penDown, penMove, penUp, type TraceResult, type Tracer } from './tracing'
import type { Point } from './letters'

const S     = GLYPHS.S
const guide = S.strokes[0]
const first = guide[0]
const last  = guide.at(-1)!

// Moves the pen along a list of points; returns the last non-null result
function trace(tr: Tracer, id: number, points: Point[]) {
  let result: TraceResult | null = null
  for (const p of points) result = penMove(tr, id, p) ?? result
  return result
}

// Points on the straight line from a to b
const line = (a: Point, b: Point, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }))

describe('tracer', () => {
  it('completes the letter when the pen follows the guide', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, first, 10)).toEqual({ accepted: true })
    expect(trace(tr, 1, guide)).toBe('letter-done')
    expect(tr.done).toBe(true)
  })

  it('forgives a wobbly line close to the guide', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    const wobbly = guide.map((p, i) => ({ x: p.x + (i % 2 ? 6 : -6), y: p.y + (i % 3 ? 5 : -5) }))
    expect(trace(tr, 1, wobbly)).toBe('letter-done')
  })

  it('only starts near the green start dot', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, guide[Math.floor(guide.length / 2)], 10)).toEqual({ accepted: false, reason: 'far-from-start' })
    expect(penDown(tr, 1, { x: first.x + 15, y: first.y + 10 }, 10)).toEqual({ accepted: true })
  })

  it('knows when the pen starts at the wrong end of the stroke', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, last, 10)).toEqual({ accepted: false, reason: 'wrong-end' })
  })

  it('tells a touch beside the letter from one on it', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, { x: first.x + 60, y: first.y }, 10)).toEqual({ accepted: false, reason: 'off-letter' })
  })

  it('ignores a contact much bigger than the pen, like a resting hand', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    penUp(tr, 1)
    expect(penDown(tr, 2, first, 60)).toEqual({ accepted: false, reason: 'too-big' })
  })

  it('takes the iPad pen, which always reports 41.6 px', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, first, 41.6)).toEqual({ accepted: true })
  })

  it('remembers the pen size across letters', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 41.6)
    const next = createTracer(S, tr.smallest)
    expect(penDown(next, 2, first, 125)).toEqual({ accepted: false, reason: 'too-big' })
    expect(penDown(next, 3, first, 62.4)).toEqual({ accepted: true })
  })

  it('accepts a touch whose size the browser does not report', () => {
    const tr = createTracer(S)
    expect(penDown(tr, 1, first, 0)).toEqual({ accepted: true })
  })

  it('follows only the pen while a hand touches elsewhere', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    expect(penDown(tr, 2, first, 10)).toEqual({ accepted: false, reason: 'pen-busy' })
    expect(penMove(tr, 2, last)).toBeNull()
    expect(penUp(tr, 2)).toBeNull()
    expect(trace(tr, 1, guide)).toBe('letter-done')
  })

  it('does not count a shortcut straight to the end', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    expect(trace(tr, 1, line(first, last))).toBeNull()
    expect(penUp(tr, 1)).toBe('too-short')
  })

  it('does not count tracing backwards', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    expect(trace(tr, 1, [...guide].reverse())).toBeNull()
  })

  it('starts the stroke over after lifting too early', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    trace(tr, 1, guide.slice(0, guide.length / 2))
    expect(tr.progress).toBeGreaterThan(0)
    expect(penUp(tr, 1)).toBe('too-short')
    expect(tr.progress).toBe(0)
    expect(penDown(tr, 3, first, 10)).toEqual({ accepted: true })
    expect(trace(tr, 3, guide)).toBe('letter-done')
  })

  it('accepts nothing more once the letter is done', () => {
    const tr = createTracer(S)
    penDown(tr, 1, first, 10)
    trace(tr, 1, guide)
    expect(penUp(tr, 1)).toBeNull()
    expect(penDown(tr, 2, first, 10)).toEqual({ accepted: false, reason: 'done' })
  })

  it('counts a dot as soon as it is tapped', () => {
    const tr = createTracer(GLYPHS.Ä)
    const strokes = GLYPHS.Ä.strokes
    for (const [s, g] of strokes.slice(0, 2).entries()) {
      penDown(tr, s, g[0], 10)
      for (const p of g) penMove(tr, s, p)
      penUp(tr, s)
    }
    const [left, right] = strokes.slice(2).map(g => g[0])
    expect(penDown(tr, 7, left, 10)).toEqual({ accepted: true })
    expect(penUp(tr, 7)).toBe('stroke-done')
    expect(penDown(tr, 8, right, 10)).toEqual({ accepted: true })
    expect(penUp(tr, 8)).toBe('letter-done')
    expect(tr.done).toBe(true)
  })
})
