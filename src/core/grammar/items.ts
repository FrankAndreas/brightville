import { answersOf } from '@/core/vocab/answer'
import type { Lang } from '@/core/vocab/types'
import { GRAMMAR, type Topic } from './content'

/** One gap sentence of a topic, ready to ask: `answers` all count (the first is shown), `wrong` at least three */
export interface GrammarItem {
  /** `<lang>:<topic>:<id>`; a form item's id is `<frame>.<verb>.<person>` */
  key: string
  topic: string
  text: string
  hint?: string
  answers: string[]
  wrong: string[]
}

const GAP = '___'
const tidy = (s: string) => s.replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A French subject and its verb part: je → j' before a vowel or h */
function withSubject(person: string, verb: string): string {
  return person === 'je' && /^[aeiouyhàâéèêëîïôûù]/i.test(verb) ? `j'${verb}` : `${person} ${verb}`
}

/** Distinct texts, none equal to a right answer */
function distinctWrong(candidates: string[], answers: string[]): string[] {
  const taken = new Set(answers.map(tidy))
  const out: string[] = []
  for (const c of candidates) {
    if (!c || taken.has(tidy(c))) continue
    taken.add(tidy(c))
    out.push(c)
  }
  return out
}

function formItems(lang: Lang, topic: Extract<Topic, { kind: 'form' }>): GrammarItem[] {
  const out: GrammarItem[] = []
  for (const frame of topic.frames) {
    const subjectInText = frame.text.includes('{s}')
    for (const verbName of frame.verbs) {
      const verb = topic.verbs[verbName]
      const formOf = (p: string) => typeof verb.forms === 'string' ? verb.forms : verb.forms[p]
      const persons = frame.persons ?? topic.persons
      // A frame without a subject in it (English "Mr Brown …") is one item
      for (const person of subjectInText || lang === 'fr' ? persons : persons.slice(0, 1)) {
        const key = `${lang}:${topic.id}:${frame.id}.${verbName}.${person}`
        const parts = answersOf(formOf(person))
        // English: the subject is in the sentence and the gap is the verb; French: the gap is subject and verb
        if (lang === 'en') {
          const text = frame.text.replace('{s}', person)
          const answers = parts
          out.push({
            key, topic: topic.id, text: frame.text.startsWith('{s}') ? capital(text) : text, hint: `(${verbName})`, answers,
            wrong: distinctWrong([...(verb.wrong ?? []), verbName], answers),
          })
        } else {
          const answers = parts.map(v => withSubject(person, v))
          const others = topic.persons.filter(p => p !== person).map(p => answersOf(formOf(p))[0])
          out.push({
            key, topic: topic.id, text: frame.text, hint: `(${person} · ${verbName})`, answers,
            wrong: distinctWrong([...others, ...(verb.wrong ?? [])].map(v => withSubject(person, v)), answers),
          })
        }
      }
    }
  }
  return out
}

const cache = new Map<string, GrammarItem[]>()

/** Every item of a topic (form topics made from their frames and verb table) */
export function itemsOf(lang: Lang, topicId: string): GrammarItem[] {
  const at = `${lang}:${topicId}`
  const known = cache.get(at)
  if (known) return known
  const topic = GRAMMAR[lang].find(t => t.id === topicId)
  const items: GrammarItem[] = !topic ? [] : topic.kind === 'form' ? formItems(lang, topic) : topic.items.map(i => ({
    key: `${lang}:${topic.id}:${i.id}`, topic: topic.id, text: i.text, hint: i.hint, answers: i.answers,
    wrong: distinctWrong(i.wrong, i.answers),
  }))
  cache.set(at, items)
  return items
}

/** The item with this key, if it (still) exists */
export function itemByKey(key: string): GrammarItem | undefined {
  const [lang, topic] = key.split(':')
  if (lang !== 'en' && lang !== 'fr') return undefined
  return itemsOf(lang, topic).find(i => i.key === key)
}

/** The sentence with the first answer in the gap (a capital when the gap starts it) */
export function filled(item: GrammarItem): string {
  const answer = item.answers[0] ?? ''
  return item.text.startsWith(GAP) ? capital(answer) + item.text.slice(GAP.length) : item.text.replace(GAP, answer)
}
