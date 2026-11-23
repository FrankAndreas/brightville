import { answersOf } from '@/core/vocab/answer'
import type { Lang } from '@/core/vocab/types'

// Whether the recogniser heard what he was to say. It writes as it likes ("2" or "two", accents or none, "today" or
// "to day"), so only the sounds' words count: case, punctuation, apostrophes, hyphens, spaces and accents don't.

const EN_SMALL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const FR_SMALL = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
  'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
]
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/** A number 0–100 in words */
export function numberWords(n: number, lang: Lang): string {
  if (lang === 'en') {
    if (n === 100) return 'one hundred'
    if (n < 20) return EN_SMALL[n]
    return EN_TENS[Math.floor(n / 10)] + (n % 10 ? `-${EN_SMALL[n % 10]}` : '')
  }
  if (n === 100) return 'cent'
  if (n < 20) return FR_SMALL[n]
  if (n < 70) {
    const unit = n % 10
    return FR_TENS[Math.floor(n / 10)] + (unit === 1 ? ' et un' : unit ? `-${FR_SMALL[unit]}` : '')
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${FR_SMALL[n - 60]}`
  if (n === 80) return 'quatre-vingts'
  return `quatre-vingt-${FR_SMALL[n - 80]}`
}

/** What is left to compare: figures (0–100) as words, small letters without accents, nothing but letters and figures.
 * `feminine`: a French figure ending in one says "une" ("1 sœur" = "une sœur", "21 heures" = "vingt et une heures") */
export function spokenForm(text: string, lang: Lang, feminine = false): string {
  const said = (n: number) => {
    const words = numberWords(n, lang)
    return feminine && lang === 'fr' && /\bun$/.test(words) ? `${words}e` : words
  }
  return text
    .replace(/\d+/g, d => (Number(d) <= 100 ? ` ${said(Number(d))} ` : d))
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

const withoutTo = (text: string) => text.trim().replace(/^to\s+/i, '')

/**
 * Whether any of the recogniser's alternatives says one of the expected answers (` / ` between them). `word`: an
 * English verb may leave out its "to", as in the School.
 */
export function heardRight(alternatives: string[], expected: string, lang: Lang, opts: { word?: boolean } = {}): boolean {
  const loose = lang === 'en' && opts.word
  const form = (text: string) => spokenForm(loose ? withoutTo(text) : text, lang)
  const answers = answersOf(expected).map(form).filter(Boolean)
  // A French figure ending in one: the recogniser doesn't say whether it was "un" or "une", so both are tried
  const forms = (text: string) =>
    lang === 'fr' && /\d/.test(text) ? [form(text), spokenForm(loose ? withoutTo(text) : text, lang, true)] : [form(text)]
  return alternatives.some(heard => forms(heard).some(mine => mine !== '' && answers.includes(mine)))
}
