import { describe, expect, it } from 'vitest'
import { buildRound, ownWords, pickChoices } from './round'
import { builtinWords } from './builtin'
import type { Progress, VocabList, VocabWord } from './types'

const TODAY = '2026-11-12'
const word = (i: number, lang = 'en'): VocabWord => ({ key: `${lang}:t:w${i}`, de: `Wort ${i}`, foreign: `word ${i}`, source: 't' })
const fixed = () => 0.3

describe('buildRound', () => {
  it('due words first (oldest first), then at most 4 new in list order, then the soonest due', () => {
    const words = Array.from({ length: 33 }, (_, i) => word(i))
    const progress: Progress = {}
    // 0..2 due (2 the oldest), 3..22 new, 23..32 not yet due (32 the soonest)
    progress['en:t:w0'] = { box: 2, due: '2026-11-12' }
    progress['en:t:w1'] = { box: 2, due: '2026-11-11' }
    progress['en:t:w2'] = { box: 1, due: '2026-11-01' }
    for (let i = 23; i <= 32; i++) progress[`en:t:w${i}`] = { box: 3, due: `2026-12-${String(42 - i).padStart(2, '0')}` }
    const round = buildRound(words, progress, TODAY, fixed)
    expect(round.map(r => r.word.key)).toEqual([
      'en:t:w2', 'en:t:w1', 'en:t:w0',
      'en:t:w3', 'en:t:w4', 'en:t:w5', 'en:t:w6',
      'en:t:w32', 'en:t:w31', 'en:t:w30',
    ])
  })

  it('a small source makes a short round, each word once', () => {
    const progress: Progress = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`en:t:w${i}`, { box: 2, due: TODAY }]))
    const round = buildRound(Array.from({ length: 6 }, (_, i) => word(i)), progress, TODAY, fixed)
    expect(round).toHaveLength(6)
    expect(new Set(round.map(r => r.word.key)).size).toBe(6)
  })

  it('never more than four new words, even when the source has nothing else', () => {
    expect(buildRound(Array.from({ length: 25 }, (_, i) => word(i)), {}, TODAY, fixed)).toHaveLength(4)
  })

  it('box 0 and 1 are choices; box 2 and up are typed, in turn German → foreign and foreign → German', () => {
    const words = Array.from({ length: 6 }, (_, i) => word(i))
    const progress: Progress = {
      'en:t:w0': { box: 1, due: TODAY }, 'en:t:w1': { box: 2, due: TODAY }, 'en:t:w2': { box: 3, due: TODAY },
      'en:t:w3': { box: 4, due: TODAY },
    }
    const modes = buildRound(words, progress, TODAY, fixed).map(r => [r.word.key, r.mode])
    expect(modes).toEqual([
      ['en:t:w0', 'choice'], ['en:t:w1', 'type-de'], ['en:t:w2', 'type-foreign'], ['en:t:w3', 'type-de'],
      ['en:t:w4', 'choice'], ['en:t:w5', 'choice'],
    ])
  })

  it('choices: four different ones with the answer, from the source first, never from the other language', () => {
    const source = [word(1), word(2)]
    const pool = [...source, ...builtinWords('en')]
    const choices = pickChoices(source[0], pool, Math.random)
    expect(choices).toHaveLength(4)
    expect(new Set(choices).size).toBe(4)
    expect(choices).toContain('word 1')
    expect(choices).toContain('word 2')
    const french = new Set(builtinWords('fr').map(w => w.foreign))
    expect(choices.some(c => french.has(c))).toBe(false)
  })

  it('a choice shows only the first answer of each word', () => {
    const w = { ...word(1), foreign: 'railway station / train station' }
    const choices = pickChoices(w, [w, word(2), word(3), word(4)], fixed)
    expect(choices).toContain('railway station')
  })
})

describe('ownWords', () => {
  const lists: VocabList[] = [
    { id: 2, lang: 'en', name: 'Unit 4', words: [{ de: 'der Kompass', foreign: 'compass' }, { de: 'der Bahnhof', foreign: 'station' }] },
    { id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'Bahnhof', foreign: 'Station' }, { de: 'der Kompass', foreign: 'Compass' }] },
    { id: 3, lang: 'fr', name: 'Unité 1', words: [{ de: 'der Kompass', foreign: 'la boussole' }] },
  ]

  it('one language, lists in the order made, the same word in two lists once', () => {
    expect(ownWords(lists, 'en').map(w => [w.key, w.source])).toEqual([
      ['en:own:station|bahnhof', 'own:1'], ['en:own:compass|der kompass', 'own:1'], ['en:own:station|der bahnhof', 'own:2'],
    ])
    expect(ownWords(lists, 'fr').map(w => w.key)).toEqual(['fr:own:la boussole|der kompass'])
  })

  it('or only one list', () => {
    expect(ownWords(lists, 'en', 2).map(w => w.key)).toEqual(['en:own:compass|der kompass', 'en:own:station|der bahnhof'])
  })

describe('his words and the built-in ones', () => {
  it('a word of his that is also built in shares its progress (the built-in key)', () => {
    const lists: VocabList[] = [{ id: 1, lang: 'en', name: 'U', words: [{ de: 'der Bahnhof', foreign: 'Railway station' }] }]
    expect(ownWords(lists, 'en').map(w => w.key)).toEqual(['en:travel:station'])
  })

  it('one foreign word with two German meanings is two words', () => {
    const lists: VocabList[] = [{ id: 1, lang: 'en', name: 'U', words: [{ de: 'die Bank', foreign: 'bank' }, { de: 'das Ufer', foreign: 'bank' }] }]
    expect(ownWords(lists, 'en')).toHaveLength(2)
  })

  it('never offers a second right answer among the choices', () => {
    const bank = { key: 'en:own:bank|die bank', de: 'die Bank', foreign: 'bank', source: 'own:1' }
    const bench = { key: 'en:own:bench|die bank', de: 'die Bank', foreign: 'bench', source: 'own:1' }
    for (let i = 0; i < 20; i++) {
      expect(pickChoices(bank, [bank, bench, ...builtinWords('en')], Math.random)).not.toContain('bench')
    }
  })
})
})
