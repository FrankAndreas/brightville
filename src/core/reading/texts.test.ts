import { describe, expect, it } from 'vitest'
import { BUILTIN } from '@/core/vocab/builtin'
import type { Lang } from '@/core/vocab/types'
import { allTexts, READING, textKey } from './texts'

const FRENCH = /[àâçéèêëîïôûùüÿœæ]/i
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Whether `word` stands in `text` as a whole word or phrase (any case) */
export const standsIn = (word: string, text: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu').test(text)

export function checkReading(lang: Lang) {
  it('has the topics of the word lists, three texts each', () => {
    expect(READING[lang].map(t => [t.id, t.name])).toEqual(BUILTIN[lang].map(t => [t.id, t.name]))
    for (const topic of READING[lang]) {
      expect(topic.texts, topic.id).toHaveLength(3)
      expect(new Set(topic.texts.map(t => t.id)).size, topic.id).toBe(3)
    }
  })

  it('every text is well formed: sentences, glossary words found in it, four questions', () => {
    for (const { key, text } of allTexts(lang)) {
      expect(text.title.length, key).toBeGreaterThan(0)
      expect(text.sentences.length, key).toBeGreaterThanOrEqual(6)
      expect(text.sentences.length, key).toBeLessThanOrEqual(10)
      for (const s of text.sentences) expect(s.length, key).toBeLessThanOrEqual(200)
      expect(text.glossary.length, key).toBeGreaterThanOrEqual(8)
      expect(text.glossary.length, key).toBeLessThanOrEqual(15)
      const all = text.sentences.join(' ')
      for (const g of text.glossary) {
        expect(standsIn(g.word, all), `${key}: ${g.word}`).toBe(true)
        expect(g.de.length, `${key}: ${g.word}`).toBeGreaterThan(0)
      }
      expect(new Set(text.glossary.map(g => g.word.toLowerCase())).size, key).toBe(text.glossary.length)
      expect(text.questions, key).toHaveLength(4)
      for (const q of text.questions) {
        expect(q.question.endsWith('?'), `${key}: ${q.question}`).toBe(true)
        expect(q.answers, key).toHaveLength(4)
        expect(new Set(q.answers).size, `${key}: ${q.question}`).toBe(4)
        expect([0, 1, 2, 3], key).toContain(q.right)
      }
      if (lang === 'en') expect(text.title + all, key).not.toMatch(FRENCH)
    }
  })
}

describe('English texts', () => {
  checkReading('en')

  it('keys a text by language, topic and id', () => {
    expect(textKey('en', 'travel', 'x')).toBe('en:travel:x')
    expect(allTexts('en')).toHaveLength(36)
    expect(allTexts('en', 'food').every(x => x.topic === 'food' && x.key.startsWith('en:food:'))).toBe(true)
  })
})
