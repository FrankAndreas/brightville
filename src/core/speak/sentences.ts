import en from '../../../shared/speak/en.json'
import fr from '../../../shared/speak/fr.json'
import type { Lang } from '@/core/vocab/types'

/** An everyday sentence to say aloud (shared/speak/<lang>.json), with its German */
export interface Sentence {
  /** `<lang>:speak:sentence:<topic>:<id>` */
  key: string
  text: string
  de: string
  topic: string
}

const FILES: Record<Lang, typeof en> = { en, fr }

/** The 60 sentences of a language, topic by topic */
export function sentences(lang: Lang): Sentence[] {
  return FILES[lang].topics.flatMap(t =>
    t.sentences.map(s => ({ key: `${lang}:speak:sentence:${t.id}:${s.id}`, text: s.text, de: s.de, topic: t.id })))
}
