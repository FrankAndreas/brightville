import { describe, expect, it } from 'vitest'
import { createRoundFlow } from '@/buildings/vokabeln/roundFlow'
import { answersOf } from '@/core/vocab/answer'
import { itemsOf } from './items'
import { buildGrammarRound, isSure, toRoundItem, isWeak, rightOfLast10, typesNow, weakest, type GrammarProgress } from './round'

const record = (rights: boolean[], missed: string[] = []) => ({ recent: rights, missed })
const times = (n: number, v: boolean) => Array.from({ length: n }, () => v)

describe('grammar rounds', () => {
  it('a topic round has 10 distinct items, chosen while the topic is new', () => {
    const round = buildGrammarRound('en', 'modals', {}, Math.random)
    expect(round).toHaveLength(10)
    expect(new Set(round.map(r => r.word.key)).size).toBe(10)
    for (const r of round) {
      expect(r.mode).toBe('choice')
      expect(r.choices).toHaveLength(4)
      expect(new Set(r.choices).size).toBe(4)
      const right = answersOf(r.word.foreign).map(a => a.toLowerCase())
      expect(r.choices!.filter(c => right.includes(c.toLowerCase()))).toHaveLength(1)
    }
  })

  it('types once he has 5 of his last 10 right', () => {
    const at = (n: number): GrammarProgress => ({ 'en:modals': record([...times(10 - n, false), ...times(n, true)]) })
    expect(buildGrammarRound('en', 'modals', at(4), Math.random).every(r => r.mode === 'choice')).toBe(true)
    expect(buildGrammarRound('en', 'modals', at(5), Math.random).every(r => r.mode === 'type-de')).toBe(true)
  })

  it('the items he missed last come first', () => {
    const progress = { 'fr:articles': record([false, false], ['fr:articles:7', 'fr:articles:3']) }
    const round = buildGrammarRound('fr', 'articles', progress, Math.random)
    expect(round.slice(0, 2).map(r => r.word.key)).toEqual(['fr:articles:7', 'fr:articles:3'])
  })

  it('"Gemischt" on a first visit: 10 distinct items from several topics', () => {
    const round = buildGrammarRound('fr', undefined, {}, Math.random)
    expect(round).toHaveLength(10)
    expect(new Set(round.map(r => r.word.key)).size).toBe(10)
    expect(new Set(round.map(r => r.word.source)).size).toBeGreaterThanOrEqual(3)
    expect(round.every(r => r.word.key.startsWith('fr:'))).toBe(true)
  })

  it('"Gemischt" leans towards weak topics', () => {
    const strong = Object.fromEntries(itemsOf('en', 'modals').length ? [
      'present-simple-continuous', 'past-simple', 'present-perfect', 'will-going-to', 'do-questions', 'comparison',
      'some-any', 'adverbs', 'relatives', 'if-will', 'passive',
    ].map(t => [`en:${t}`, record(times(10, true))]) : [])
    let weak = 0
    for (let i = 0; i < 20; i++) weak += buildGrammarRound('en', undefined, { ...strong, 'en:modals': record(times(10, false)) }, Math.random).filter(r => r.word.source === 'modals').length
    // modals weighs 11 against 1 for each of the eleven others: about half of all items
    expect(weak).toBeGreaterThan(60)
  })

  it('sure, weak and the weakest topics', () => {
    expect(rightOfLast10(record([...times(15, false), ...times(10, true)].slice(-20)))).toBe(10)
    expect(typesNow(undefined)).toBe(false)
    expect(isSure(record([...times(2, false), ...times(8, true)]))).toBe(true)
    expect(isSure(record([...times(3, false), ...times(7, true)]))).toBe(false)
    expect(isWeak(record(times(4, false)))).toBe(false)
    expect(isWeak(record(times(5, false)))).toBe(true)
    const progress: GrammarProgress = {
      'fr:articles': record([...times(4, false), ...times(6, true)]),
      'fr:negation': record(times(6, false)),
      'fr:partitive': record([...times(8, false), ...times(2, true)]),
      'fr:possessives': record(times(10, true)),
      'fr:questions': record([...times(3, false), ...times(7, true)]),
      'en:modals': record(times(10, false)),
    }
    expect(weakest('fr', progress)).toEqual(['negation', 'partitive', 'articles'])
  })

  it('a typed grammar answer takes both forms of a contraction and the iPad apostrophe', () => {
    const source = itemsOf('en', 'do-questions').find(i => i.answers.includes("don't play"))!
    const item = toRoundItem(source, true, Math.random)
    expect(item.mode).toBe('type-de')
    const first = answersOf(item!.word.foreign)[0]
    for (const typed of [first.replace("'", '’'), answersOf(item!.word.foreign)[1]]) {
      const flow = createRoundFlow([item!], 'en')
      flow.answer(typed)
      expect(flow.state.phase, typed).toBe('right')
    }
  })
})
