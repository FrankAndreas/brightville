import en from '../../../shared/grammar/en.json'
import fr from '../../../shared/grammar/fr.json'
import type { Lang } from '@/core/vocab/types'

/**
 * A hand-written gap sentence: `text` has one "___"; `hint` is shown after the gap (e.g. "(go)"); `answers` all count
 * (the first is shown); `wrong` are three plausible wrong choices
 */
export interface ChoiceItem {
  id: string
  text: string
  hint?: string
  answers: string[]
  wrong: string[]
}

/**
 * A sentence frame for a form topic: one "___" and, in English, "{s}" where the subject goes; the verbs that fit it;
 * `persons`: only these subjects (a frame saying "my" or "our"), else all of the topic's
 */
export interface Frame {
  id: string
  text: string
  verbs: string[]
  persons?: string[]
}

/**
 * A verb of a form topic's table: its form per person written out (French: the verb part, after the subject), or one
 * form for every person (English past simple); `wrong`: typical mistakes, used as wrong choices
 */
export interface Verb {
  forms: Record<string, string> | string
  wrong?: string[]
}

interface TopicBase {
  id: string
  /** German, on the shelf */
  name: string
  /** One line in German, shown after each answer */
  rule: string
}

export type Topic =
  | (TopicBase & { kind: 'choice'; items: ChoiceItem[] })
  | (TopicBase & { kind: 'form'; persons: string[]; verbs: Record<string, Verb>; frames: Frame[] })

/** The grammar topics per language (shared/grammar/<lang>.json): first drafts at about A2, for the parents to check */
export const GRAMMAR: Record<Lang, Topic[]> = { en: en.topics as Topic[], fr: fr.topics as Topic[] }
