import { isWeak, rightOfLast10, typesNow } from '@/core/grammar/round'
import type { RoundItem } from '@/core/vocab/round'
import type { Lang } from '@/core/vocab/types'
import { dateWords, DAYS, MONTHS, ordinalWord, shownDate, shownTime, timeWords } from './words'

export type DateKind = 'clock-words' | 'words-clock' | 'words-date' | 'date-words' | 'spelling'

/** The five kinds of task, with their German names (the parents' page) */
export const KINDS: { id: DateKind; name: string }[] = [
  { id: 'clock-words', name: 'Uhr ablesen' },
  { id: 'words-clock', name: 'Uhrzeit verstehen' },
  { id: 'words-date', name: 'Datum verstehen' },
  { id: 'date-words', name: 'Datum schreiben' },
  { id: 'spelling', name: 'Tage und Monate' },
]

/** His record per kind `<lang>:<kind>`, as the server keeps it (backend/app/dates.py) */
export type DatesProgress = Record<string, { recent: boolean[] }>

const PER_KIND = 2
const RECENT = 10
/** Always picked from four: a clock or a date can't be typed */
const ALWAYS_CHOICE: DateKind[] = ['words-clock', 'words-date']
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DE_ORDINALS = [
  '', 'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte', 'neunte', 'zehnte', 'elfte', 'zwölfte',
  'dreizehnte', 'vierzehnte', 'fünfzehnte', 'sechzehnte', 'siebzehnte', 'achtzehnte', 'neunzehnte', 'zwanzigste',
  'einundzwanzigste', 'zweiundzwanzigste', 'dreiundzwanzigste', 'vierundzwanzigste', 'fünfundzwanzigste',
  'sechsundzwanzigste', 'siebenundzwanzigste', 'achtundzwanzigste', 'neunundzwanzigste', 'dreissigste',
  'einunddreissigste',
]

type Rec = { recent: boolean[]; missed: string[] } | undefined
/** A kind's record in the shape the grammar's sure/weak rules read (they only look at `recent`) */
export const asRec = (p: { recent: boolean[] } | undefined): Rec => (p ? { recent: p.recent, missed: [] } : undefined)

const pickInt = (rand: () => number, n: number) => Math.floor(rand() * n)

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const randomTime = (rand: () => number) => ({ h: 1 + pickInt(rand, 12), m: 5 * pickInt(rand, 12) })
const randomDate = (rand: () => number) => {
  const mo = 1 + pickInt(rand, 12)
  return { d: 1 + pickInt(rand, MONTH_DAYS[mo - 1]), mo }
}

/** The things to spell, by group: German prompt and the word in the language (French: days and months only) */
function spellings(lang: Lang): { de: string; word: string; group: 'day' | 'month' | 'ordinal' }[] {
  const days = DAYS[lang].map((word, i) => ({ de: DAYS.de[i], word, group: 'day' as const }))
  const months = MONTHS[lang].map((word, i) => ({ de: MONTHS.de[i], word, group: 'month' as const }))
  const ordinals = lang === 'en'
    ? Array.from({ length: 31 }, (_, i) => ({ de: `der ${DE_ORDINALS[i + 1]} (${i + 1}.)`, word: ordinalWord(i + 1), group: 'ordinal' as const }))
    : []
  return [...days, ...months, ...ordinals]
}

interface Task {
  /** What is asked, whatever the kind ("t 8:15", "d 14.7.", "s Montag"): no two tasks of a round ask the same */
  value: string
  /** What is shown (or said) */
  prompt: string
  /** Every right answer, the one to show first */
  answers: string[]
  /** Three other first answers, to choose from */
  others: (rand: () => number) => string[]
}

/** Three distinct values made by `make`, none equal to one of `taken` (case and curly apostrophes aside) */
function threeOthers(make: () => string, taken: string[]): string[] {
  const tidy = (s: string) => s.replace(/[’‘]/g, "'").toLowerCase()
  const seen = new Set(taken.map(tidy))
  const out: string[] = []
  for (let tries = 0; out.length < 3 && tries < 200; tries++) {
    const x = make()
    if (seen.has(tidy(x))) continue
    seen.add(tidy(x))
    out.push(x)
  }
  return out
}

function makeTask(lang: Lang, kind: DateKind, rand: () => number): Task {
  if (kind === 'clock-words' || kind === 'words-clock') {
    const { h, m } = randomTime(rand)
    const words = timeWords(lang, h, m)
    const value = `t ${shownTime(h, m)}`
    if (kind === 'clock-words') {
      return { value, prompt: shownTime(h, m), answers: words, others: r => threeOthers(() => { const t = randomTime(r); return timeWords(lang, t.h, t.m)[0] }, words) }
    }
    return { value, prompt: words[0], answers: [shownTime(h, m)], others: r => threeOthers(() => { const t = randomTime(r); return shownTime(t.h, t.m) }, [shownTime(h, m)]) }
  }
  if (kind === 'words-date' || kind === 'date-words') {
    const { d, mo } = randomDate(rand)
    const words = dateWords(lang, d, mo)
    const value = `d ${shownDate(d, mo)}`
    if (kind === 'date-words') {
      return { value, prompt: shownDate(d, mo), answers: words, others: r => threeOthers(() => { const x = randomDate(r); return dateWords(lang, x.d, x.mo)[0] }, words) }
    }
    return { value, prompt: words[0], answers: [shownDate(d, mo)], others: r => threeOthers(() => { const x = randomDate(r); return shownDate(x.d, x.mo) }, [shownDate(d, mo)]) }
  }
  const all = spellings(lang)
  const one = all[pickInt(rand, all.length)]
  // Wrong choices from the same group (a day among days); "der dritte" may also be typed "the third"
  const group = all.filter(x => x.group === one.group)
  const answers = one.group === 'ordinal' ? [one.word, `the ${one.word}`] : [one.word]
  return { value: `s ${one.de}`, prompt: one.de, answers, others: r => threeOthers(() => group[pickInt(r, group.length)].word, answers) }
}

/** The kind of a round item, from its key `<lang>:<kind>:<n>` */
export function kindOf(key: string): DateKind {
  return key.split(':')[1] as DateKind
}

/**
 * A round of ten: two tasks of each kind, mixed, no prompt twice. Clocks and dates to recognise are always picked from
 * four; the others are picked while the kind is new to him and typed once he has 5 of his last 10 right.
 */
export function buildDatesRound(lang: Lang, progress: DatesProgress, rand: () => number): RoundItem[] {
  const prompts = new Set<string>()
  const items: RoundItem[] = []
  let n = 0
  for (const { id: kind } of KINDS) {
    for (let made = 0; made < PER_KIND;) {
      const task = makeTask(lang, kind, rand)
      if (prompts.has(task.value)) continue
      prompts.add(task.value)
      made++
      const word = { key: `${lang}:${kind}:${n++}`, de: task.prompt, foreign: task.answers.join(' / '), source: kind }
      const typed = !ALWAYS_CHOICE.includes(kind) && typesNow(asRec(progress[`${lang}:${kind}`]))
      items.push(typed ? { word, mode: 'type-de' } : { word, mode: 'choice', choices: shuffle([task.answers[0], ...task.others(rand)], rand) })
    }
  }
  return shuffle(items, rand)
}

/** Lays one round's first answers over the record, as the server does: per kind the last 10 */
export function layDates(progress: DatesProgress, item: { lang: string; answers: { kind: string; right: boolean }[] }): DatesProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    const parts = a.kind.split(':')
    if (parts.length !== 2 || parts[0] !== item.lang || !parts[1]) continue
    next[a.kind] = { recent: [...(next[a.kind]?.recent ?? []), a.right].slice(-RECENT) }
  }
  return next
}


/** The weak kinds of a language (≥ 5 tries, < 8 of the last 10 right), the fewest right first, at most three */
export function weakestKinds(lang: Lang, progress: DatesProgress, n = 3): DateKind[] {
  return KINDS
    .map(k => ({ id: k.id, p: asRec(progress[`${lang}:${k.id}`]) }))
    .filter(x => isWeak(x.p))
    .sort((a, b) => rightOfLast10(a.p) - rightOfLast10(b.p))
    .slice(0, n)
    .map(x => x.id)
}

