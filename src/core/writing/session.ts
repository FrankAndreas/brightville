import { DIGITS, LETTERS } from './letters'
import { helpFor, type Help, type Letters } from './levels'

export type { Help } from './levels'

export interface WritingTask {
  glyph: string
  help: Help
  /** One of the three writes that introduce a new letter */
  intro?: boolean
  /** This write may move the letter's level */
  counts?: boolean
}

export const LETTERS_PER_VISIT = 2
export const STARS_PER_LETTER = 1
/** On top, for writing every letter of the visit */
export const SET_BONUS = 4

const INTRO: Help[] = ['full', 'dots', 'start']
const TIMES = 3
const ALL = [...LETTERS, ...DIGITS]

function shuffled<T>(items: T[], rand: () => number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (pool.length) out.push(...pool.splice(Math.floor(rand() * pool.length), 1))
  return out
}

/** Glyphs she hasn't met, in the order they come in: those of her words first, then letters, then digits */
function newOnes(letters: Letters, texts: string[], rand: () => number): string[] {
  const out: string[] = []
  for (const c of texts.join('')) if (ALL.includes(c) && !letters[c] && !out.includes(c)) out.push(c)
  const fresh = (g: string) => !letters[g] && !out.includes(g)
  out.push(...shuffled(LETTERS.filter(fresh), rand), ...shuffled(DIGITS.filter(fresh), rand))
  return out
}

/** Her letters, weakest first: lowest level, then the longest unpractised (never practised first) */
function weakest(letters: Letters): string[] {
  return Object.keys(letters).sort((a, b) => {
    const [x, y] = [letters[a], letters[b]]
    if (x.level !== y.level) return x.level - y.level
    if (x.practised_at === y.practised_at) return a < b ? -1 : 1
    if (x.practised_at === null) return -1
    if (y.practised_at === null) return 1
    return x.practised_at < y.practised_at ? -1 : 1
  })
}

/**
 * Today's letters (🎲): two glyphs, each written three times. New ones (as many as `newLeft` allows) come with falling
 * help; the other places go to her weakest letters at their own help. With nothing to repeat, more new ones.
 */
export function buildDailyRound(o: { letters: Letters; texts: string[]; newLeft: number; rand: () => number }): WritingTask[] {
  const fresh = newOnes(o.letters, o.texts, o.rand)
  const intros = fresh.slice(0, Math.max(0, Math.min(o.newLeft, LETTERS_PER_VISIT)))
  const repeats = weakest(o.letters).slice(0, LETTERS_PER_VISIT - intros.length)
  intros.push(...fresh.slice(intros.length, intros.length + LETTERS_PER_VISIT - intros.length - repeats.length))
  return [
    ...intros.flatMap(glyph => INTRO.map(help => ({ glyph, help, intro: true }))),
    ...repeats.flatMap(glyph => Array.from({ length: TIMES }, () => ({ glyph, help: helpFor(o.letters[glyph].level), counts: true }))),
  ]
}

/** A word or sentence, letter by letter (spaces left out), each with the help her level gives */
export function textTasks(text: string, letters: Letters): WritingTask[] {
  return [...text].filter(c => c !== ' ').map(glyph => {
    const level = letters[glyph]?.level ?? 0
    return { glyph, help: helpFor(level), counts: level >= 1 }
  })
}

/** Stars for `written` of `total` letters. */
export function starsFor(written: number, total: number): number {
  return written * STARS_PER_LETTER + (total > 0 && written >= total ? SET_BONUS : 0)
}
