import type { Card } from '@/core/memory'
import { answersOf } from './answer'
import type { Lang, Progress, VocabWord } from './types'

// The Spielhalle at Oberstufe: a memory of words, each a pair of cards: the word in the language and its German.

export const MEMORY_PAIRS = 6
const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }

/** A card of the word memory: its text, the voice it is said in, and the word (key) its pair stands for */
export type WordCard = Card & { text: string; voice: string; word: string }

const first = (w: VocabWord) => answersOf(w.foreign)[0] ?? w.foreign
const plain = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
/** The German without its article, to see whether a word looks the same in both languages ("hotel" / "das Hotel") */
const bare = (de: string) => plain(de).replace(/^(der|die|das|ein|eine) /, '')

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Six words for a round: those he met in the School first (box ≥ 1, at random), then new ones. Never a word that looks
 * the same in both languages, and never two cards with the same text (two words sharing their word or their German).
 */
export function pickMemoryWords(words: VocabWord[], progress: Progress, rand: () => number, n = MEMORY_PAIRS): VocabWord[] {
  const met = shuffle(words.filter(w => (progress[w.key]?.box ?? 0) >= 1), rand)
  const fresh = shuffle(words.filter(w => (progress[w.key]?.box ?? 0) < 1), rand)
  const texts = new Set<string>()
  const out: VocabWord[] = []
  for (const w of [...met, ...fresh]) {
    if (out.length >= n) break
    const f = plain(first(w))
    const d = plain(w.de)
    if (f === bare(w.de) || f === d || texts.has(f) || texts.has(d)) continue
    texts.add(f)
    texts.add(d)
    out.push(w)
  }
  return out
}

/** Every word twice, as the word in the language and as its German, shuffled */
export function wordDeck(words: VocabWord[], lang: Lang, rand: () => number): WordCard[] {
  const cards: WordCard[] = words.flatMap(w => [
    { id: w.key, key: `${w.key}-f`, emoji: '', say: first(w), text: first(w), voice: VOICE[lang], word: w.key },
    { id: w.key, key: `${w.key}-d`, emoji: '', say: w.de, text: w.de, voice: 'de-DE', word: w.key },
  ])
  return shuffle(cards, rand)
}

/** He met the word and its day has come: a right answer moves it, as in the School */
export function dueToday(key: string, progress: Progress, today: string): boolean {
  const p = progress[key]
  return !!p && p.box >= 1 && p.due <= today
}
