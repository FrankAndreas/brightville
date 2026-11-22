import { buildRound, type RoundItem } from './round'
import type { Progress, VocabWord } from './types'

/**
 * Spelling (Schreiben's dictation at Oberstufe) has its own record: a word's spelling key is its word key with
 * `spell` after the language (`en:travel:station` → `en:spell:travel:station`), kept like any other word's box.
 */
export function spellKey(key: string): string {
  const at = key.indexOf(':')
  return `${key.slice(0, at)}:spell${key.slice(at)}`
}

/** The same words, with their spelling keys */
export function spellingWords(words: VocabWord[]): VocabWord[] {
  return words.map(w => ({ ...w, key: spellKey(w.key) }))
}

/** A dictation: the School's choice of words (due first, at most four new, then due soonest) on the spelling record, every word dictated */
export function buildDictation(words: VocabWord[], progress: Progress, today: string, rand: () => number): RoundItem[] {
  return buildRound(spellingWords(words), progress, today, rand).map(({ word }) => ({ word, mode: 'dictate' }))
}
