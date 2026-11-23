import { answersOf, sameWord } from '@/core/vocab/answer'
import type { Lang, Progress, VocabWord } from '@/core/vocab/types'
import { sentences } from './sentences'

// A speaking round in the Trommelhaus at Oberstufe: ten items to say, words and everyday sentences, one language.

export const SPEAK_ROUND = 10
const MIN_SENTENCES = 3
const MAX_TRANSLATE = 5
/** Übersetzen only for words he knows well */
const TRANSLATE_BOX = 3
const MAX_TEXT = 60

/** His record per item, as the server keeps it (backend/app/speak.py) */
export type SpeakProgress = Record<string, { right: number; last_right: string | null; last_asked: string | null }>

export interface SpeakItem {
  /** `<lang>:speak:<word>` or `<lang>:speak:sentence:<topic>:<id>` */
  key: string
  /** Nachsprechen (the foreign text shown and spoken) or Übersetzen (the German shown) */
  mode: 'repeat' | 'translate'
  kind: 'word' | 'sentence'
  /** The foreign form with all its answers (` / ` between them), for the check */
  text: string
  /** The foreign form to show: the first answer */
  shown: string
  de: string
}

/** A word's speaking key: its key with `speak` after the language (`en:travel:window` → `en:speak:travel:window`) */
export function speakKey(word: VocabWord, lang: Lang): string {
  return `${lang}:speak:${word.key.slice(lang.length + 1)}`
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Least said right first, then those not asked today; at random among equals */
function byNeed<T extends { key: string }>(items: T[], said: SpeakProgress, today: string, rand: () => number): T[] {
  const need = (x: T) => (said[x.key]?.right ?? 0) * 2 + (said[x.key]?.last_asked === today ? 1 : 0)
  return shuffle(items, rand).sort((a, b) => need(a) - need(b))
}

/**
 * Ten items: up to five words he knows well (box ≥ 3) to translate, at least three sentences, the rest words to repeat
 * (more sentences when there are too few words); shuffled. Only words of this language, with a German and short enough.
 */
export function buildSpeakRound(
  lang: Lang, words: VocabWord[], vocab: Progress, said: SpeakProgress, rand: () => number, today: string,
): SpeakItem[] {
  const seen = new Set<string>()
  // One word once, even when it is in his list and in a topic too (two keys, the same word)
  const same = new Set<string>()
  const usable = words
    .filter(w => w.key.startsWith(`${lang}:`) && w.de.trim() && (answersOf(w.foreign)[0] ?? '').length > 0)
    .filter(w => answersOf(w.foreign)[0].length <= MAX_TEXT && w.de.length <= MAX_TEXT)
    .map(w => ({ key: speakKey(w, lang), word: w }))
    .filter(x => !seen.has(x.key) && seen.add(x.key))
    .filter(x => !same.has(sameWord(x.word.foreign, x.word.de)) && same.add(sameWord(x.word.foreign, x.word.de)))
  const item = (x: { key: string; word: VocabWord }, mode: SpeakItem['mode']): SpeakItem => ({
    key: x.key, mode, kind: 'word', text: x.word.foreign, shown: answersOf(x.word.foreign)[0], de: x.word.de,
  })

  const known = byNeed(usable.filter(x => (vocab[x.word.key]?.box ?? 0) >= TRANSLATE_BOX), said, today, rand)
  const translate = known.slice(0, MAX_TRANSLATE)
  const rest = byNeed(usable.filter(x => !translate.includes(x)), said, today, rand)
  const sentenceCount = Math.max(MIN_SENTENCES, SPEAK_ROUND - translate.length - rest.length)
  const repeat = rest.slice(0, SPEAK_ROUND - translate.length - sentenceCount)
  const chosenSentences = byNeed(sentences(lang), said, today, rand).slice(0, sentenceCount)

  return shuffle([
    ...translate.map(x => item(x, 'translate')),
    ...repeat.map(x => item(x, 'repeat')),
    ...chosenSentences.map(s => ({ key: s.key, mode: 'repeat' as const, kind: 'sentence' as const, text: s.text, shown: s.text, de: s.de })),
  ], rand)
}

/** Lays one round's answers over the record, as the server does (backend/app/speak.py) */
export function laySpeak(
  progress: SpeakProgress, item: { lang: string; answers: { item: string; right: boolean }[] }, today: string,
): SpeakProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    if (!a.item.startsWith(`${item.lang}:speak:`)) continue
    const old = next[a.item]
    next[a.item] = {
      right: (old?.right ?? 0) + (a.right ? 1 : 0),
      last_right: a.right ? today : old?.last_right ?? null,
      last_asked: today,
    }
  }
  return next
}

/** Sentences and words of a language he said right at least once (`known`: only these keys, the ones that exist now) */
export function saidCount(lang: Lang, progress: SpeakProgress, known?: Set<string>): number {
  return Object.entries(progress)
    .filter(([k, p]) => k.startsWith(`${lang}:speak:`) && p.right >= 1 && (!known || known.has(k))).length
}
