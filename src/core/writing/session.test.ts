import { describe, expect, it } from 'vitest'
import { seededRandom } from '../numbers'
import { DIGITS, LETTERS } from './letters'
import type { Letters } from './levels'
import { SET_BONUS, STARS_PER_LETTER, buildDailyRound, starsFor, textTasks } from './session'

const known = (level: 1 | 2 | 3 | 4, practised_at: string | null = null) => ({ level, streak: 0, practised_at })
const glyphsOf = (tasks: { glyph: string }[]) => [...new Set(tasks.map(t => t.glyph))]

describe('buildDailyRound', () => {
  it('introduces the letters of her words first, each three times with less help', () => {
    const tasks = buildDailyRound({ letters: {}, texts: ['LENA'], newLeft: 2, rand: seededRandom(1) })
    expect(tasks).toEqual([
      { glyph: 'L', help: 'full', intro: true },
      { glyph: 'L', help: 'dots', intro: true },
      { glyph: 'L', help: 'start', intro: true },
      { glyph: 'E', help: 'full', intro: true },
      { glyph: 'E', help: 'dots', intro: true },
      { glyph: 'E', help: 'start', intro: true },
    ])
  })

  it('skips letters she already met and spaces', () => {
    const tasks = buildDailyRound({ letters: { L: known(2), E: known(3) }, texts: ['LE NA'], newLeft: 2, rand: seededRandom(1) })
    expect(glyphsOf(tasks)).toEqual(['N', 'A'])
  })

  it('fills the other place with her weakest letter, three times at its own help', () => {
    const tasks = buildDailyRound({ letters: { A: known(1), B: known(3) }, texts: ['LENA'], newLeft: 1, rand: seededRandom(1) })
    expect(tasks.slice(0, 3).every(t => t.glyph === 'L' && t.intro)).toBe(true)
    expect(tasks.slice(3)).toEqual([
      { glyph: 'A', help: 'full', counts: true },
      { glyph: 'A', help: 'full', counts: true },
      { glyph: 'A', help: 'full', counts: true },
    ])
  })

  it('with no new letter left, repeats the weakest: lowest level, then the longest unpractised', () => {
    const letters: Letters = {
      A: known(2, '2026-11-01T10:00:00+01:00'),
      B: known(1, '2026-11-10T10:00:00+01:00'),
      C: known(1, '2026-11-05T10:00:00+01:00'),
      D: known(4, null),
    }
    const tasks = buildDailyRound({ letters, texts: [], newLeft: 0, rand: seededRandom(1) })
    expect(glyphsOf(tasks)).toEqual(['C', 'B'])
    expect(tasks.every(t => t.counts && !t.intro && t.help === 'full')).toBe(true)
  })

  it('puts a letter never practised before one practised long ago', () => {
    const letters: Letters = { A: known(2, '2026-11-01T10:00:00+01:00'), B: known(2, null), C: known(3) }
    expect(glyphsOf(buildDailyRound({ letters, texts: [], newLeft: 0, rand: seededRandom(1) }))).toEqual(['B', 'A'])
  })

  it('after her words, other letters before digits', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const tasks = buildDailyRound({ letters: {}, texts: [], newLeft: 2, rand: seededRandom(seed) })
      for (const g of glyphsOf(tasks)) expect(LETTERS).toContain(g)
    }
    const allLetters = Object.fromEntries(LETTERS.map(l => [l, known(4)]))
    const tasks = buildDailyRound({ letters: allLetters, texts: [], newLeft: 1, rand: seededRandom(2) })
    expect(DIGITS).toContain(tasks[0].glyph)
    expect(tasks[0].intro).toBe(true)
  })

  it('with too few letters met and no new letter allowed, fills the round with practice that introduces nothing', () => {
    const tasks = buildDailyRound({ letters: { A: known(2) }, texts: ['MIA'], newLeft: 0, rand: seededRandom(1) })
    expect(glyphsOf(tasks)).toEqual(['A', 'M'])
    expect(tasks.slice(3)).toEqual([
      { glyph: 'M', help: 'full' },
      { glyph: 'M', help: 'dots' },
      { glyph: 'M', help: 'start' },
    ])
  })

  it('with everything known, repeats', () => {
    const all = Object.fromEntries([...LETTERS, ...DIGITS].map(l => [l, known(4)]))
    const tasks = buildDailyRound({ letters: all, texts: [], newLeft: 2, rand: seededRandom(1) })
    expect(tasks).toHaveLength(6)
    expect(tasks.every(t => t.counts && t.help === 'none')).toBe(true)
  })
})

describe('textTasks', () => {
  it('is one task per letter, with help from her level; new letters show in full and do not count', () => {
    expect(textTasks('MIA BEN', { M: known(4), B: known(2) })).toEqual([
      { glyph: 'M', help: 'none', counts: true },
      { glyph: 'I', help: 'full', counts: false },
      { glyph: 'A', help: 'full', counts: false },
      { glyph: 'B', help: 'dots', counts: true },
      { glyph: 'E', help: 'full', counts: false },
      { glyph: 'N', help: 'full', counts: false },
    ])
  })
})

describe('starsFor', () => {
  it('gives one Star per letter written and the bonus only for all of them', () => {
    expect(STARS_PER_LETTER).toBe(1)
    expect(SET_BONUS).toBe(4)
    expect(starsFor(0, 6)).toBe(0)
    expect(starsFor(5, 6)).toBe(5)
    expect(starsFor(6, 6)).toBe(10)
    expect(starsFor(3, 3)).toBe(7)
  })
})
