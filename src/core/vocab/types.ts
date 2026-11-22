/** The Oberstufe's languages: never mixed in a list, a round, its choices or its voice */
export type Lang = 'en' | 'fr'
export const LANGS: Lang[] = ['en', 'fr']

/** One word to practise: German and the foreign side (` / ` between answers that all count; the first is shown) */
export interface VocabWord {
  /** `<lang>:<topic>:<id>` built in, `<lang>:own:<first foreign answer>` from his lists */
  key: string
  de: string
  foreign: string
  /** Where it comes from: a built-in topic's id, or `own:<listId>` */
  source: string
}

/** One of his lists, as the server keeps it (backend/app/vocab.py) */
export interface VocabList {
  id: number
  lang: Lang
  name: string
  words: { de: string; foreign: string }[]
}

/** How well he knows a word: its box (0 new … 5) and the day it is due again */
export type Progress = Record<string, { box: number; due: string }>
