import { describe, expect, it } from 'vitest'
import { BOX, DIGITS, GLYPHS, LETTERS, fitView, viewBox, type Point } from './letters'
import { createTracer, penDown, penMove, penUp, type TraceResult } from './tracing'

const ALL = Object.keys(GLYPHS)
const [TOP, , BASE, DESC] = BOX.lines

// Stroke counts of the official templates (Spielzeugkiste, docs/handwriting/basisschrift.md)
const STROKES: Record<string, number> = {
  A: 2, B: 2, C: 1, D: 2, E: 3, F: 3, G: 1, H: 3, I: 1, J: 1, K: 2, L: 1, M: 1, N: 2, O: 1, P: 2,
  Q: 2, R: 2, S: 1, T: 2, U: 1, V: 1, W: 1, X: 2, Y: 1, Z: 1, Ä: 4, Ö: 3, Ü: 3,
  0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 2, 8: 1, 9: 1,
}

const near = (a: Point, b: Point, d = 8) => Math.hypot(a.x - b.x, a.y - b.y) <= d
const start = (ch: string, s = 0): Point => GLYPHS[ch].strokes[s][0]
const end = (ch: string, s = 0): Point => GLYPHS[ch].strokes[s].at(-1)!

describe('glyphs', () => {
  it('has the whole alphabet with Ä, Ö, Ü and the digits 0-9', () => {
    expect(LETTERS.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ')
    expect(DIGITS.join('')).toBe('0123456789')
    expect(ALL.sort()).toEqual([...DIGITS, ...LETTERS].sort())
  })

  it.each(ALL)('%s has the documented number of strokes', ch => {
    expect(GLYPHS[ch].strokes).toHaveLength(STROKES[ch])
  })

  it.each(ALL)('%s stays in the box with evenly spaced points', ch => {
    for (const g of GLYPHS[ch].strokes) {
      if (g.length === 1) continue   // a dot
      expect(g.length).toBeGreaterThan(5)
      for (let i = 0; i < g.length; i++) {
        expect(g[i].x).toBeGreaterThanOrEqual(0)
        expect(g[i].x).toBeLessThanOrEqual(BOX.width)
        expect(g[i].y).toBeGreaterThanOrEqual(0)
        expect(g[i].y).toBeLessThanOrEqual(DESC + 2)
        if (i) expect(Math.hypot(g[i].x - g[i - 1].x, g[i].y - g[i - 1].y)).toBeLessThanOrEqual(2.5)
      }
    }
  })

  it('follows the documented directions', () => {
    // A: one stroke up from the bottom left over the tip, then the bar from the left
    expect(start('A').y).toBeGreaterThan(BASE - 8)
    expect(end('A').x).toBeGreaterThan(start('A').x + 50)
    expect(end('A', 1).x).toBeGreaterThan(start('A', 1).x)
    // E and L: down and along the bottom in one stroke
    for (const ch of 'EL') expect(end(ch).y).toBeGreaterThan(BASE - 8)
    for (const ch of 'EL') expect(end(ch).x).toBeGreaterThan(start(ch).x + 30)
    // N: the diagonal down, then up the right line
    expect(end('N', 1).y).toBeLessThan(TOP + 8)
    // R: the bowl and the leg in one stroke
    expect(end('R', 1).y).toBeGreaterThan(BASE - 8)
    // G and J reach down into the bottom band
    for (const ch of 'GJ') expect(Math.max(...GLYPHS[ch].strokes[0].map(p => p.y))).toBeGreaterThan(DESC - 10)
    // C, O, S, G, 0 start at the top
    for (const ch of 'COSG0') expect(start(ch).y).toBeLessThan(TOP + 10)
    // 1: up from the flag, then down
    expect(start('1').y).toBeGreaterThan(TOP + 15)
    expect(end('1').y).toBeGreaterThan(BASE - 8)
    // 4: first the slant and the bar, then the line down
    expect(end('4', 0).x).toBeGreaterThan(start('4', 0).x)
    expect(end('4', 1).y).toBeGreaterThan(BASE - 8)
    // 5 and 7: the bar along the top is a stroke of its own
    expect(near(start('5', 1), start('5', 0))).toBe(true)
    expect(near(end('7', 0), { x: end('7', 0).x, y: BASE })).toBe(true)
    // 9: the loop first, then the stem down
    expect(end('9').y).toBeGreaterThan(BASE - 8)
    // T: the line down first, then the bar
    expect(end('T', 0).y).toBeGreaterThan(BASE - 8)
    // M: up from the bottom left, like A
    expect(start('M').y).toBeGreaterThan(BASE - 8)
    // Ä, Ö, Ü: the letter, then the left dot and the right dot above the cap line
    for (const ch of 'ÄÖÜ') {
      const [left, right] = GLYPHS[ch].strokes.slice(-2)
      expect(left).toHaveLength(1)
      expect(right).toHaveLength(1)
      expect(left[0].x).toBeLessThan(right[0].x)
      expect(left[0].y).toBeLessThan(TOP)
    }
  })

  it.each(ALL)('%s can be traced stroke by stroke', ch => {
    const tr = createTracer(GLYPHS[ch])
    const results = GLYPHS[ch].strokes.map((g, s) => {
      expect(penDown(tr, s, g[0], 10)).toEqual({ accepted: true })
      let r: TraceResult | null = null
      for (const p of g) r = penMove(tr, s, p) ?? r
      penUp(tr, s)
      return r
    })
    expect(results.at(-1)).toBe('letter-done')
    expect(results.slice(0, -1).every(r => r === 'stroke-done')).toBe(true)
  })

  it.each(ALL)('%s has a spoken name with its article', ch => {
    expect(GLYPHS[ch].say).toMatch(/^eine? \S/)
  })
})

describe('viewBox', () => {
  it('shows the lines with room for the bottom band', () => {
    const v = viewBox(['S', 'I'])
    expect(v.x).toBe(0)
    expect(v.width).toBe(BOX.width)
    expect(v.y).toBeLessThan(TOP)
    expect(v.y + v.height).toBeGreaterThan(DESC)
  })

  it('makes room above the cap line only for dots', () => {
    const plain = viewBox(['A'])
    const dots  = viewBox(['Ä'])
    expect(dots.y).toBeLessThan(Math.min(...GLYPHS.Ä.strokes.flat().map(p => p.y)))
    expect(dots.height).toBeGreaterThan(plain.height)
    expect(plain.y).toBeGreaterThan(TOP - 15)
  })
})

describe('fitView', () => {
  it('centres the view box as big as fits, with a little room', () => {
    const v = { x: 0, y: 20, width: 120, height: 200 }
    const f = fitView(v, 1000, 1000)
    expect(f.scale).toBeCloseTo(1000 / 200 * 0.95)
    expect(f.ox + (v.x + v.width / 2) * f.scale).toBeCloseTo(500)
    expect(f.oy + (v.y + v.height / 2) * f.scale).toBeCloseTo(500)
  })
})
