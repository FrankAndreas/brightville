import type { Lang } from './types'

/** How a typed answer compares: right, off only in its accents or umlauts (that counts as wrong, but is shown so), or wrong */
export interface Checked {
  verdict: 'right' | 'accent' | 'wrong'
  /** The answer to show: the first one, or the one that was only off in its accents */
  shown: string
  /** Where in `shown` the accents were off */
  marks: number[]
}

/** The answers that all count (` / ` between them), spaces collapsed */
export function answersOf(expected: string): string[] {
  return expected.split(' / ').map(a => a.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** Small letters, single spaces, a straight apostrophe, no final . ! ? */
function tidy(text: string): string {
  return text.replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*[.!?]$/, '')
}

/** A letter without its accent (œ and æ as two letters) */
function base(letter: string): string {
  const lower = letter.toLowerCase()
  if (lower === 'œ') return 'oe'
  if (lower === 'æ') return 'ae'
  return lower.normalize('NFD').replace(/\p{M}/gu, '')
}

const plain = (text: string) => [...text].map(base).join('')
const withoutTo = (text: string) => text.replace(/^to /, '')

/**
 * Compares what he typed with the answers: case, spaces and a final full stop, ! or ? don't matter; an English verb may
 * leave out its "to". Accents and umlauts count: an answer off only in them is 'accent', with the letters marked.
 */
export function checkAnswer(typed: string, expected: string, opts: { lang: Lang | 'de' }): Checked {
  const answers = answersOf(expected)
  const shown = answers[0] ?? ''
  const mine = tidy(typed)
  if (!mine) return { verdict: 'wrong', shown, marks: [] }
  const same = (a: string, b: string) => a === b || (opts.lang === 'en' && withoutTo(a) === withoutTo(b))
  if (answers.some(a => same(tidy(a), mine))) return { verdict: 'right', shown, marks: [] }
  for (const answer of answers) {
    if (same(plain(tidy(answer)), plain(mine))) return { verdict: 'accent', shown: answer, marks: marksIn(answer, mine) }
  }
  return { verdict: 'wrong', shown, marks: [] }
}

/** The letters of `answer` that `typed` wrote without (or with another) accent */
function marksIn(answer: string, typed: string): number[] {
  const marks: number[] = []
  const letters = [...answer]
  const mine = [...typed]
  let at = 0
  letters.forEach((letter, i) => {
    const width = base(letter).length
    const written = mine.slice(at, at + width).join('')
    at += width
    if (written !== letter.toLowerCase()) marks.push(i)
  })
  return marks
}

/** His own word's key: the language and its first answer, small and with single spaces */
export function ownKey(lang: Lang, foreign: string): string {
  return `${lang}:own:${(answersOf(foreign)[0] ?? '').toLowerCase()}`
}
