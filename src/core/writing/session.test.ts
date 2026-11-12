import { describe, expect, it } from 'vitest'
import { seededRandom } from '../numbers'
import { GLYPHS } from './letters'
import { LETTERS_PER_VISIT, SET_BONUS, STARS_PER_LETTER, buildWritingSession, starsFor } from './session'

describe('buildWritingSession', () => {
  it('gives two different glyphs, each three times with less help each time', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const tasks = buildWritingSession(seededRandom(seed))
      expect(tasks).toHaveLength(LETTERS_PER_VISIT * 3)
      expect(tasks.map(t => t.help)).toEqual(['full', 'dots', 'start', 'full', 'dots', 'start'])
      const [a, b] = [tasks[0].glyph, tasks[3].glyph]
      expect(a).not.toBe(b)
      expect(tasks.map(t => t.glyph)).toEqual([a, a, a, b, b, b])
      expect(GLYPHS[a]).toBeDefined()
      expect(GLYPHS[b]).toBeDefined()
    }
  })

  it('draws from the glyphs it is given', () => {
    const tasks = buildWritingSession(seededRandom(3), ['A', 'B'])
    expect(new Set(tasks.map(t => t.glyph))).toEqual(new Set(['A', 'B']))
  })

  it('reaches every letter and digit over many visits', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 400; seed++) for (const t of buildWritingSession(seededRandom(seed))) seen.add(t.glyph)
    expect(seen.size).toBe(Object.keys(GLYPHS).length)
  })
})

describe('starsFor', () => {
  it('gives one Star per letter written and the bonus only for all of them', () => {
    expect(STARS_PER_LETTER).toBe(1)
    expect(SET_BONUS).toBe(4)
    expect(starsFor(0, 6)).toBe(0)
    expect(starsFor(5, 6)).toBe(5)
    expect(starsFor(6, 6)).toBe(10)
  })
})
