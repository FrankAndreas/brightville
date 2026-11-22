import { describe, expect, it } from 'vitest'
import { BUILTIN, builtinWords } from './builtin'
import { LANGS } from './types'

const TOPICS = ['travel', 'school', 'family', 'freetime', 'food', 'jobs', 'health', 'home', 'town', 'nature', 'shopping', 'feelings']
// German adjectives that end like a verb
const NOT_TO = new Set(['geschieden', 'zufrieden'])
const ACCENTS = /[éèêàâçôîûëïùœ]/

describe('the built-in lists', () => {
  it.each(LANGS)('%s has the twelve topics, with German names and 22 to 28 words each', lang => {
    expect(BUILTIN[lang].map(t => t.id)).toEqual(TOPICS)
    for (const topic of BUILTIN[lang]) {
      expect(topic.name).toMatch(/^[A-ZÄÖÜ]/)
      expect(topic.words.length).toBeGreaterThanOrEqual(22)
      expect(topic.words.length).toBeLessThanOrEqual(28)
    }
  })

  it.each(LANGS)('%s: unique ids within a topic, no empty side, no side over 60', lang => {
    for (const topic of BUILTIN[lang]) {
      expect(new Set(topic.words.map(w => w.id)).size).toBe(topic.words.length)
      for (const w of topic.words) {
        expect(w.de.trim()).not.toBe('')
        expect(w.foreign.trim()).not.toBe('')
        expect(w.de.length).toBeLessThanOrEqual(60)
        expect(w.foreign.length).toBeLessThanOrEqual(60)
      }
    }
  })

  it('French nouns carry their article', () => {
    for (const w of builtinWords('fr')) {
      if (/^(der|die|das) /.test(w.de)) expect(w.foreign, w.de).toMatch(/^(le |la |l'|les |un |une )/)
    }
  })

  it('English verbs carry their "to"', () => {
    for (const w of builtinWords('en')) {
      const verb = /^[a-zäöü]+en$/.test(w.de) || /^sich [a-zäöü]+en$/.test(w.de)
      if (verb && !NOT_TO.has(w.de)) expect(w.foreign, w.de).toMatch(/^to /)
    }
  })

  it('the languages are never mixed', () => {
    for (const w of builtinWords('en')) expect(w.foreign, w.foreign).not.toMatch(ACCENTS)
    const english = new Set(builtinWords('en').map(w => w.foreign))
    for (const w of builtinWords('fr')) expect(english.has(w.foreign), w.foreign).toBe(false)
  })

  it('keys say the language and the topic, and the source is the topic', () => {
    const [first] = builtinWords('en')
    expect(first.key).toBe(`en:travel:${BUILTIN.en[0].words[0].id}`)
    expect(first.source).toBe('travel')
    expect(builtinWords('fr').every(w => w.key.startsWith('fr:'))).toBe(true)
  })
})
