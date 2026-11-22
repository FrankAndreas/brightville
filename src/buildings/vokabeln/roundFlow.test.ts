import { describe, expect, it } from 'vitest'
import type { RoundItem } from '@/core/vocab/round'
import { createRoundFlow } from './roundFlow'

const item = (i: number, mode: RoundItem['mode'] = 'type-de'): RoundItem => ({
  word: { key: `fr:t:w${i}`, de: `Wort ${i}`, foreign: i === 0 ? "l'école" : `mot ${i}`, source: 't' },
  mode,
  ...(mode === 'choice' ? { choices: [`mot ${i}`, 'autre', 'encore', 'plus'] } : {}),
})
const items = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1))

describe('the round', () => {
  it('a right first answer gives a Star and goes on', () => {
    const flow = createRoundFlow(items(2), 'fr')
    flow.answer('mot 1')
    expect(flow.state.phase).toBe('right')
    expect(flow.state.stars).toBe(1)
    expect(flow.state.firstTry).toEqual([{ key: 'fr:t:w1', right: true }])
    flow.next()
    expect(flow.state.phase).toBe('asking')
    expect(flow.state.item?.word.key).toBe('fr:t:w2')
  })

  it('an empty answer is not an answer', () => {
    const flow = createRoundFlow(items(1), 'fr')
    flow.answer('  ')
    expect(flow.state.phase).toBe('asking')
    expect(flow.state.firstTry).toEqual([])
  })

  it('a wrong answer shows the right one; he types it to go on; the word comes back once, without a Star', () => {
    const flow = createRoundFlow(items(2), 'fr')
    flow.answer('mot 9')
    expect(flow.state.phase).toBe('wrong')
    expect(flow.state.checked?.shown).toBe('mot 1')
    flow.retype('mot 9')
    expect(flow.state.phase).toBe('wrong')
    flow.retype('mot 1')
    expect(flow.state.phase).toBe('right')
    expect(flow.state.stars).toBe(0)
    flow.next()
    flow.answer('mot 2')
    flow.next()
    // Word 1 again, at the end
    expect(flow.state.item?.word.key).toBe('fr:t:w1')
    flow.answer('mot 9')
    flow.retype('mot 1')
    flow.next()
    expect(flow.state.phase).toBe('done')
    expect(flow.state.stars).toBe(1)
    expect(flow.state.firstTry).toEqual([{ key: 'fr:t:w1', right: false }, { key: 'fr:t:w2', right: true }])
    expect(flow.state.total).toBe(2)
  })

  it('a word right the second time gives no Star and is not counted twice', () => {
    const flow = createRoundFlow(items(1), 'fr')
    flow.answer('x')
    flow.retype('mot 1')
    flow.next()
    flow.answer('mot 1')
    expect(flow.state.stars).toBe(0)
    expect(flow.state.firstTry).toHaveLength(1)
  })

  it('only the accent off is wrong too, with the accent marked', () => {
    const flow = createRoundFlow([item(0)], 'fr')
    flow.answer("l'ecole")
    expect(flow.state.phase).toBe('wrong')
    expect(flow.state.checked).toEqual({ verdict: 'accent', shown: "l'école", marks: [2] })
  })

  it('a typed foreign word is answered in German', () => {
    const flow = createRoundFlow([item(1, 'type-foreign')], 'fr')
    flow.answer('wort 1')
    expect(flow.state.phase).toBe('right')
  })

  it('a choice: the right one, or a wrong one to type out', () => {
    const flow = createRoundFlow([item(1, 'choice'), item(2, 'choice')], 'fr')
    flow.choose('mot 1')
    expect(flow.state.phase).toBe('right')
    flow.next()
    flow.choose('autre')
    expect(flow.state.phase).toBe('wrong')
    flow.retype('mot 2')
    expect(flow.state.phase).toBe('right')
  })

  it('ten of ten right the first time: 10 + 5 Stars; nine: 9', () => {
    const all = createRoundFlow(items(10), 'fr')
    for (let i = 1; i <= 10; i++) { all.answer(`mot ${i}`); all.next() }
    expect(all.state.phase).toBe('done')
    expect(all.state.stars).toBe(15)
    const nine = createRoundFlow(items(10), 'fr')
    for (let i = 1; i <= 10; i++) { nine.answer(i === 3 ? 'x' : `mot ${i}`); if (i === 3) nine.retype('mot 3'); nine.next() }
    nine.answer('mot 3')
    nine.next()
    expect(nine.state.phase).toBe('done')
    expect(nine.state.stars).toBe(9)
  })

  it('a short round gets no bonus', () => {
    const flow = createRoundFlow(items(3), 'fr')
    for (let i = 1; i <= 3; i++) { flow.answer(`mot ${i}`); flow.next() }
    expect(flow.state.stars).toBe(3)
  })
})
