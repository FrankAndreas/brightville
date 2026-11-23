import { describe, expect, it } from 'vitest'
import { builtinWords } from '@/core/vocab/builtin'
import type { Progress, VocabWord } from '@/core/vocab/types'
import { buildSpeakRound, laySpeak, saidCount, speakKey, SPEAK_ROUND, type SpeakProgress } from './round'

const TODAY = '2026-11-23'
const words = builtinWords('en')

describe('a speaking round', () => {
  it('a fresh child: ten items, at least three sentences, all to repeat, every key once', () => {
    for (let i = 0; i < 30; i++) {
      const round = buildSpeakRound('en', words, {}, {}, Math.random, TODAY)
      expect(round).toHaveLength(SPEAK_ROUND)
      expect(SPEAK_ROUND).toBe(10)
      expect(round.filter(x => x.kind === 'sentence').length).toBeGreaterThanOrEqual(3)
      expect(round.every(x => x.mode === 'repeat')).toBe(true)
      expect(new Set(round.map(x => x.key)).size).toBe(10)
      expect(round.every(x => x.key.startsWith('en:speak:'))).toBe(true)
    }
  })

  it('words he knows well (box 3 and up) are to translate, at most five, never a sentence', () => {
    const vocab: Progress = Object.fromEntries(words.slice(0, 12).map(w => [w.key, { box: 3, due: '2026-12-01' }]))
    vocab[words[20].key] = { box: 2, due: TODAY }
    for (let i = 0; i < 30; i++) {
      const round = buildSpeakRound('en', words, vocab, {}, Math.random, TODAY)
      const translate = round.filter(x => x.mode === 'translate')
      expect(translate).toHaveLength(5)
      expect(translate.every(x => x.kind === 'word' && words.slice(0, 12).some(w => speakKey(w, 'en') === x.key))).toBe(true)
      expect(round.filter(x => x.kind === 'sentence').length).toBeGreaterThanOrEqual(3)
      expect(round).toHaveLength(10)
    }
  })

  it('never mixes languages', () => {
    const round = buildSpeakRound('fr', [...builtinWords('fr'), ...words], {}, {}, Math.random, TODAY)
    expect(round.every(x => x.key.startsWith('fr:speak:'))).toBe(true)
  })

  it('what he said right before comes after what he never said', () => {
    const few = words.slice(0, 9)
    const said: SpeakProgress = Object.fromEntries(few.slice(0, 2).map(w => [speakKey(w, 'en'), { right: 3, last_right: '2026-11-01', last_asked: '2026-11-01' }]))
    for (let i = 0; i < 20; i++) {
      const keys = buildSpeakRound('en', few, {}, said, Math.random, TODAY).map(x => x.key)
      expect(keys).not.toContain(speakKey(few[0], 'en'))
      expect(keys).not.toContain(speakKey(few[1], 'en'))
    }
  })

  it('a word item shows its first answer and keeps all of them for the check', () => {
    const w: VocabWord = { key: 'en:own:buy|kaufen', foreign: 'buy / purchase', de: 'kaufen', source: 'l' }
    const round = buildSpeakRound('en', [w], {}, {}, Math.random, TODAY)
    const item = round.find(x => x.kind === 'word')!
    expect(item).toMatchObject({ key: 'en:speak:own:buy|kaufen', text: 'buy / purchase', shown: 'buy', de: 'kaufen', mode: 'repeat' })
    expect(round).toHaveLength(10)
  })

  it('keys: a built-in and an own word', () => {
    expect(speakKey({ key: 'fr:travel:gare', foreign: 'la gare', de: 'der Bahnhof', source: 'travel' }, 'fr')).toBe('fr:speak:travel:gare')
    expect(speakKey({ key: 'fr:own:la gare|der bahnhof', foreign: 'la gare', de: 'der Bahnhof', source: 'x' }, 'fr')).toBe('fr:speak:own:la gare|der bahnhof')
  })

  it('lays a round over the record as the server does, and counts what he said per language', () => {
    let p: SpeakProgress = {}
    p = laySpeak(p, { lang: 'en', answers: [{ item: 'en:speak:a', right: true }, { item: 'en:speak:b', right: false }, { item: 'fr:speak:c', right: true }] }, TODAY)
    expect(p['en:speak:a']).toEqual({ right: 1, last_right: TODAY, last_asked: TODAY })
    expect(p['en:speak:b']).toEqual({ right: 0, last_right: null, last_asked: TODAY })
    expect(p['fr:speak:c']).toBeUndefined()
    p['fr:speak:d'] = { right: 2, last_right: TODAY, last_asked: TODAY }
    expect(saidCount('en', p)).toBe(1)
    expect(saidCount('fr', p)).toBe(1)
  })
})
