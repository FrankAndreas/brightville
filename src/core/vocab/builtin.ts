import en from '../../../shared/vocab/en.json'
import fr from '../../../shared/vocab/fr.json'
import type { Lang, VocabWord } from './types'

/** A built-in topic list (shared/vocab/<lang>.json): A2 words, first drafts for the parents to check */
export interface BuiltinTopic {
  id: string
  /** German, shown on the shelf */
  name: string
  words: { id: string; de: string; foreign: string }[]
}

export const BUILTIN: Record<Lang, BuiltinTopic[]> = { en: en.topics, fr: fr.topics }

/** The built-in words of one language (or one topic), keyed `<lang>:<topic>:<id>` */
export function builtinWords(lang: Lang, topic?: string): VocabWord[] {
  return BUILTIN[lang]
    .filter(t => topic === undefined || t.id === topic)
    .flatMap(t => t.words.map(w => ({ key: `${lang}:${t.id}:${w.id}`, de: w.de, foreign: w.foreign, source: t.id })))
}
