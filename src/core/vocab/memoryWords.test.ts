import { describe, expect, it } from 'vitest'
import { dueToday, pickMemoryWords, wordDeck } from './memoryWords'
import type { Progress, VocabWord } from './types'

const w = (key: string, foreign: string, de: string): VocabWord => ({ key, foreign, de, source: 't' })
const many = (n: number) => Array.from({ length: n }, (_, i) => w(`en:t:w${i}`, `word${i}`, `Wort${i}`))
const TODAY = '2026-11-23'

describe('word memory', () => {
  it('takes six, the words he met first', () => {
    const words = many(20)
    const progress: Progress = Object.fromEntries(words.slice(10, 17).map(x => [x.key, { box: 1, due: '2026-12-01' }]))
    const picked = pickMemoryWords(words, progress, Math.random)
    expect(picked).toHaveLength(6)
    expect(picked.every(x => progress[x.key])).toBe(true)
  })

  it('fills up with new words when he met fewer than six', () => {
    const words = many(20)
    const progress: Progress = { [words[3].key]: { box: 2, due: TODAY } }
    const picked = pickMemoryWords(words, progress, Math.random)
    expect(picked).toHaveLength(6)
    expect(picked.map(x => x.key)).toContain(words[3].key)
  })

  it('never takes a word that looks the same in both languages, nor two with the same German or the same word', () => {
    const words = [
      w('en:t:hotel', 'hotel', 'das Hotel'), w('en:t:taxi', 'taxi', 'Taxi'),
      w('en:t:bank1', 'bank', 'die Bank'), w('en:t:bench', 'bench', 'die Bank'),
      w('en:t:bank2', 'bank', 'das Ufer'),
      ...many(10),
    ]
    for (let i = 0; i < 50; i++) {
      const picked = pickMemoryWords(words, {}, Math.random)
      const texts = picked.flatMap(x => [x.foreign.split(' / ')[0].toLowerCase(), x.de.toLowerCase()])
      expect(new Set(texts).size, texts.join(',')).toBe(12)
      expect(picked.map(x => x.key)).not.toContain('en:t:hotel')
      expect(picked.map(x => x.key)).not.toContain('en:t:taxi')
    }
  })

  it('deals twelve cards: the word and its German, both written, the same pair', () => {
    const picked = many(6)
    const deck = wordDeck(picked, 'fr', Math.random)
    expect(deck).toHaveLength(12)
    expect(new Set(deck.map(c => c.text)).size).toBe(12)
    const first = deck.filter(c => c.id === picked[0].key)
    expect(first.map(c => c.voice).sort()).toEqual(['de-DE', 'fr-FR'])
    expect(first.map(c => c.text).sort()).toEqual(['Wort0', 'word0'])
    expect(deck.every(c => c.emoji === '' && c.word === c.id)).toBe(true)
  })

  it('a word is due today when he met it and its day has come', () => {
    expect(dueToday('k', { k: { box: 1, due: TODAY } }, TODAY)).toBe(true)
    expect(dueToday('k', { k: { box: 3, due: '2026-11-20' } }, TODAY)).toBe(true)
    expect(dueToday('k', { k: { box: 2, due: '2026-11-24' } }, TODAY)).toBe(false)
    expect(dueToday('k', {}, TODAY)).toBe(false)
  })
})
