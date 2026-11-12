import { DIGITS, LETTERS } from './letters'

/** How much of the letter is shown: the whole path, dots along it, or only where to start */
export type Help = 'full' | 'dots' | 'start'

export interface WritingTask {
  glyph: string
  help: Help
}

export const LETTERS_PER_VISIT = 2
export const STARS_PER_LETTER = 1
/** On top, for writing every letter of the visit */
export const SET_BONUS = 4

const HELP: Help[] = ['full', 'dots', 'start']

/** A visit: different glyphs drawn at random, each written three times with less help each time. */
export function buildWritingSession(rand: () => number, glyphs: string[] = [...LETTERS, ...DIGITS]): WritingTask[] {
  const pool = [...glyphs]
  const tasks: WritingTask[] = []
  for (let n = 0; n < LETTERS_PER_VISIT && pool.length > 0; n++) {
    const [glyph] = pool.splice(Math.floor(rand() * pool.length), 1)
    for (const help of HELP) tasks.push({ glyph, help })
  }
  return tasks
}

/** Stars for `written` of `total` letters. */
export function starsFor(written: number, total: number): number {
  return written * STARS_PER_LETTER + (total > 0 && written >= total ? SET_BONUS : 0)
}
