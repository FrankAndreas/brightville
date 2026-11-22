import { answersOf, ownKey, sameWord } from './answer'
import { builtinWords } from './builtin'
import type { Lang, Progress, VocabList, VocabWord } from './types'

export const ROUND_SIZE = 10
export const NEW_PER_ROUND = 4
const CHOICES = 4

/** One word of a round and how it is asked: chosen from four, or typed (`type-de`: German shown, he types the foreign word) */
export interface RoundItem {
  word: VocabWord
  mode: 'choice' | 'type-de' | 'type-foreign'
  /** For a choice: four first answers, the right one among them */
  choices?: string[]
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const first = (w: VocabWord) => answersOf(w.foreign)[0] ?? w.foreign

/** Three other first answers for a word (from its own source first, then the rest of `pool`: the same language) and the word's own, mixed */
export function pickChoices(word: VocabWord, pool: VocabWord[], rand: () => number): string[] {
  const answer = first(word)
  const taken = new Set([answer.toLowerCase()])
  // Another word with the same German would be a second right answer
  const sameGerman = (other: VocabWord) => other.de.trim().toLowerCase() === word.de.trim().toLowerCase()
  const picked: string[] = []
  for (const group of [pool.filter(w => w.source === word.source), pool.filter(w => w.source !== word.source)]) {
    for (const other of shuffle(group, rand)) {
      const text = first(other)
      if (picked.length >= CHOICES - 1 || other.key === word.key || sameGerman(other) || taken.has(text.toLowerCase())) continue
      taken.add(text.toLowerCase())
      picked.push(text)
    }
  }
  const at = Math.floor(rand() * (picked.length + 1))
  return [...picked.slice(0, at), answer, ...picked.slice(at)]
}

/**
 * A round from `words` (one source, one language): the words due, the longest overdue first; then new words, at most
 * four, in their order; then the words due soonest. Each word once; a source with less makes a shorter round.
 * `pool`: where wrong choices come from after the source (the rest of the same language).
 */
export function buildRound(words: VocabWord[], progress: Progress, today: string, rand: () => number, pool: VocabWord[] = words): RoundItem[] {
  const seen = new Set<string>()
  const unique = words.filter(w => !seen.has(w.key) && seen.add(w.key))
  const known = unique.filter(w => progress[w.key])
  const byDue = (a: VocabWord, b: VocabWord) => progress[a.key].due.localeCompare(progress[b.key].due)
  const due = known.filter(w => progress[w.key].due <= today).sort(byDue)
  const later = known.filter(w => progress[w.key].due > today).sort(byDue)
  const fresh = unique.filter(w => !progress[w.key])
  const chosen = [...due.slice(0, ROUND_SIZE)]
  const firstNew = fresh.slice(0, Math.min(NEW_PER_ROUND, ROUND_SIZE - chosen.length))
  chosen.push(...firstNew)
  chosen.push(...later.slice(0, ROUND_SIZE - chosen.length))
  const choicePool = [...unique, ...pool.filter(w => !seen.has(w.key))]
  let typed = 0
  return chosen.map(word => {
    const box = progress[word.key]?.box ?? 0
    if (box <= 1) return { word, mode: 'choice', choices: pickChoices(word, choicePool, rand) }
    return { word, mode: typed++ % 2 === 0 ? 'type-de' : 'type-foreign' }
  })
}

/**
 * His words in one language (or one list): lists in the order made, each word once (by its key). A word that is also
 * built in (same first answer, same German) takes the built-in key, so it has one box wherever he meets it.
 */
export function ownWords(lists: VocabList[], lang: Lang, listId?: number): VocabWord[] {
  const builtin = new Map(builtinWords(lang).map(w => [sameWord(w.foreign, w.de), w.key]))
  const seen = new Set<string>()
  const out: VocabWord[] = []
  for (const list of [...lists].sort((a, b) => a.id - b.id)) {
    if (list.lang !== lang || (listId !== undefined && list.id !== listId)) continue
    for (const pair of list.words) {
      const key = builtin.get(sameWord(pair.foreign, pair.de)) ?? ownKey(lang, pair.foreign, pair.de)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, de: pair.de, foreign: pair.foreign, source: `own:${list.id}` })
    }
  }
  return out
}
