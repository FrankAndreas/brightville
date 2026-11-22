import type { ReadingText } from './texts'

/** His record per text `<lang>:<topic>:<id>`, as the server keeps it (backend/app/reading.py) */
export type ReadingProgress = Record<string, { reads: number; last_read: string; last_right: number }>

/** Stars: two per question right, two more for all four */
const PER_QUESTION = 2
const ALL_RIGHT_BONUS = 2
const QUESTIONS = 4

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The text of this visit: one never read (at random), else the one read longest ago (ties at random) */
export function pickText<T extends { key: string; text: ReadingText }>(all: T[], progress: ReadingProgress, rand: () => number): T | undefined {
  const unread = all.filter(x => !progress[x.key])
  if (unread.length) return shuffle(unread, rand)[0]
  return shuffle(all, rand).sort((a, b) => progress[a.key].last_read.localeCompare(progress[b.key].last_read))[0]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A sentence cut into plain parts and glossary words (with their German): whole words or phrases only, in any case,
 * the longest phrase first, every place it stands. The parts joined give back the sentence.
 */
export function segments(sentence: string, glossary: { word: string; de: string }[]): ({ text: string } | { text: string; de: string })[] {
  const entries = [...glossary].sort((a, b) => b.word.length - a.word.length)
  if (entries.length === 0) return [{ text: sentence }]
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${entries.map(e => escape(e.word)).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const out: ({ text: string } | { text: string; de: string })[] = []
  let at = 0
  for (const m of sentence.matchAll(pattern)) {
    const start = m.index ?? 0
    if (start > at) out.push({ text: sentence.slice(at, start) })
    const entry = entries.find(e => e.word.toLowerCase() === m[0].toLowerCase())!
    out.push({ text: m[0], de: entry.de })
    at = start + m[0].length
  }
  if (at < sentence.length) out.push({ text: sentence.slice(at) })
  return out
}

/** The four answers in a new order (`order[i]`: the index of the answer shown i-th) */
export function answerOrder(rand: () => number): number[] {
  return shuffle([0, 1, 2, 3], rand)
}

/** The Stars of a visit's answers so far: +2 each right, +2 when all four are right */
export function readingStars(rights: boolean[]): number {
  const right = rights.filter(Boolean).length
  return right * PER_QUESTION + (rights.length === QUESTIONS && right === QUESTIONS ? ALL_RIGHT_BONUS : 0)
}

/** Lays one visit over the record, as the server does: a text of the other language is skipped */
export function layReading(progress: ReadingProgress, item: { lang: string; answers: { text: string; right: number }[] }, today: string): ReadingProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    const parts = a.text.split(':')
    if (parts.length < 3 || parts[0] !== item.lang || parts.some(x => !x)) continue
    next[a.text] = { reads: (next[a.text]?.reads ?? 0) + 1, last_read: today, last_right: a.right }
  }
  return next
}
