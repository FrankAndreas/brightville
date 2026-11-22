import { describe, expect, it } from 'vitest'
import { buildDictation, spellKey, spellingWords } from './spelling'
import type { VocabWord } from './types'

const word = (i: number): VocabWord => ({ key: `en:own:word ${i}|wort ${i}`, de: `Wort ${i}`, foreign: `word ${i}`, source: 'own:1' })

describe('spelling', () => {
  it('puts "spell" after the language of a word key', () => {
    expect(spellKey('en:travel:station')).toBe('en:spell:travel:station')
    expect(spellKey('fr:own:la gare|der bahnhof')).toBe('fr:spell:own:la gare|der bahnhof')
  })

  it('gives the same words with spelling keys', () => {
    expect(spellingWords([word(1)])).toEqual([{ ...word(1), key: 'en:spell:own:word 1|wort 1' }])
  })

  it('a dictation of new words takes four, each dictated', () => {
    const words = Array.from({ length: 25 }, (_, i) => word(i))
    const round = buildDictation(words, {}, '2026-11-22', () => 0.5)
    expect(round).toHaveLength(4)
    expect(round.every(r => r.mode === 'dictate' && r.word.key.startsWith('en:spell:'))).toBe(true)
    expect(round.every(r => r.choices === undefined)).toBe(true)
  })

  it('follows the spelling record, not the School\'s', () => {
    const words = Array.from({ length: 12 }, (_, i) => word(i))
    const progress = Object.fromEntries(words.map(w => [spellKey(w.key), { box: 2, due: '2026-11-20' }]))
    // Known in the School does not make it known here
    progress[word(0).key] = { box: 5, due: '2027-01-01' }
    const round = buildDictation(words, progress, '2026-11-22', () => 0.5)
    expect(round).toHaveLength(10)
    expect(round.every(r => r.mode === 'dictate')).toBe(true)
  })

  it('"bank" for two German words is asked twice, each with its own key', () => {
    const bank: VocabWord = { key: 'en:own:bank|die bank', de: 'die Bank', foreign: 'bank', source: 'own:1' }
    const shore: VocabWord = { key: 'en:own:bank|das ufer', de: 'das Ufer', foreign: 'bank', source: 'own:1' }
    const keys = buildDictation([bank, shore], {}, '2026-11-22', () => 0.5).map(r => r.word.key)
    expect(keys).toEqual(['en:spell:own:bank|die bank', 'en:spell:own:bank|das ufer'])
  })
})
