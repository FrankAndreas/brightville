import { describe, expect, it } from 'vitest'
import en from '../../../shared/speak/en.json'
import fr from '../../../shared/speak/fr.json'
import vocabEn from '../../../shared/vocab/en.json'
import { sentences } from './sentences'

const TOPICS = vocabEn.topics.map(t => t.id)

describe('everyday sentences to say', () => {
  it.each([['en', en], ['fr', fr]] as const)('%s: 12 topics (the vocabulary topics) of 5 short sentences each', (_, file) => {
    expect(file.topics.map(t => t.id)).toEqual(TOPICS)
    for (const t of file.topics) {
      expect(t.sentences, t.id).toHaveLength(5)
      expect(new Set(t.sentences.map(s => s.id)).size, t.id).toBe(5)
      for (const s of t.sentences) {
        expect(s.text.length, s.text).toBeLessThanOrEqual(60)
        expect(s.text, s.text).not.toMatch(/[{}/]/)
        expect(s.de.trim(), s.text).not.toBe('')
      }
    }
  })

  it('French keeps its accents, English has no French letters', () => {
    const accents = fr.topics.flatMap(t => t.sentences).map(s => s.text).join('').match(/[éèêëàâçîïôûùœ]/g) ?? []
    expect(accents.length).toBeGreaterThanOrEqual(20)
    for (const s of en.topics.flatMap(t => t.sentences)) expect(s.text, s.text).not.toMatch(/[éèêàçœ]/)
  })

  it('gives each sentence its key', () => {
    const all = sentences('fr')
    expect(all).toHaveLength(60)
    expect(all[0]).toMatchObject({ key: `fr:speak:sentence:travel:${fr.topics[0].sentences[0].id}`, topic: 'travel', text: fr.topics[0].sentences[0].text })
    expect(new Set(all.map(s => s.key)).size).toBe(60)
  })
})
