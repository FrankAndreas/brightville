import en from '../../../shared/reading/en.json'
import fr from '../../../shared/reading/fr.json'
import type { Lang } from '@/core/vocab/types'

/**
 * A reading text (shared/reading/<lang>.json): a title and 6–10 sentences in the language, a glossary of the harder
 * words or phrases in it (→ German), and four questions in German about what it says, each with four answers
 */
export interface ReadingText {
  id: string
  title: string
  sentences: string[]
  glossary: { word: string; de: string }[]
  questions: { question: string; answers: string[]; right: number }[]
}

/** A topic of texts: the same ids and German names as the built-in word lists */
export interface ReadingTopic {
  id: string
  name: string
  texts: ReadingText[]
}

export const READING: Record<Lang, ReadingTopic[]> = { en: en.topics as ReadingTopic[], fr: fr.topics as ReadingTopic[] }

/** A text's key in his record: `<lang>:<topic>:<id>` */
export function textKey(lang: Lang, topic: string, id: string): string {
  return `${lang}:${topic}:${id}`
}

/** The texts of one language, of one topic or all ("Gemischt") */
export function allTexts(lang: Lang, topic?: string): { key: string; topic: string; text: ReadingText }[] {
  return READING[lang]
    .filter(t => topic === undefined || t.id === topic)
    .flatMap(t => t.texts.map(text => ({ key: textKey(lang, t.id, text.id), topic: t.id, text })))
}
