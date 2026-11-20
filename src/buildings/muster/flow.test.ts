import { describe, expect, it } from 'vitest'
import { exampleFor, type MusterTask, type Piece, type SortThing } from '@/core/patterns'
import { createMusterFlow, type MusterEffect } from './flow'

const c = (colour: Piece['colour']): Piece => ({ colour, shape: 'kreis', big: true })
/** rot, blau, rot, blau, ? — choices gelb, rot, grün */
const ROW: MusterTask = {
  type: 'row', feature: 'colour', pieces: [c('rot'), c('blau'), c('rot'), c('blau'), c('rot')], gap: 4,
  choices: [c('gelb'), c('rot'), c('gruen')], answer: 1,
}
const GAP: MusterTask = { ...ROW, gap: 1, choices: [c('blau'), c('gelb'), c('gruen')], answer: 0 }
const thing = (id: string, say: string, basket: 0 | 1): SortThing => ({ id, say, emoji: id, basket })
const SORT: MusterTask = {
  type: 'sort', by: 'kind', baskets: ['Tiere', 'Früchte'],
  examples: [thing('🐶', 'Hund', 0), thing('🍎', 'Apfel', 1)],
  things: [thing('🐮', 'Kuh', 0), thing('🐷', 'Schwein', 0), thing('🍌', 'Banane', 1), thing('🍐', 'Birne', 1)],
}
const said = (effects: MusterEffect[]) => effects.flatMap(e => (e.type === 'speak' ? [e.text] : []))
const lights = (effects: MusterEffect[]) => effects.flatMap(e => (e.type === 'speak' && e.light ? [e.light] : []))

describe('the Musterwerkstatt flow', () => {
  it('says a row piece by piece, lit, then asks what comes next', () => {
    const flow = createMusterFlow([ROW], null)
    const effects = flow.start()
    expect(said(effects)).toEqual(['rot', 'blau', 'rot', 'blau', 'Was kommt jetzt?'])
    expect(lights(effects)).toEqual(['piece-0', 'piece-1', 'piece-2', 'piece-3', 'gap'])
    expect(effects.at(-1)).toEqual({ type: 'speak', text: 'Was kommt jetzt?', light: 'gap', ask: true, again: 'rot, blau, rot, blau … Was kommt jetzt?' })
  })

  it('hums at a gap in the middle and asks what is missing', () => {
    const effects = createMusterFlow([GAP], null).start()
    expect(said(effects)).toEqual(['rot', 'hmm', 'rot', 'blau', 'rot', 'Was fehlt?'])
    expect(lights(effects)[1]).toBe('gap')
    // 🔊 says the same row, gap and all
    expect(effects.at(-1)).toMatchObject({ again: 'rot, hmm, rot, blau, rot. Was fehlt?' })
  })

  it('cheers the right piece and says the whole row', () => {
    const flow = createMusterFlow([ROW, ROW], null)
    flow.start()
    const effects = flow.choose(1)
    expect(effects[0]).toEqual({ type: 'chime' })
    expect(said(effects)).toEqual(['rot', 'blau', 'rot', 'blau', 'rot', 'Super!'])
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: 1, results: [{ ladder: 'muster', firstTry: true }] })
  })

  it('fades a wrong piece, says the row again, and counts the later right one as missed', () => {
    const flow = createMusterFlow([ROW, ROW], null)
    flow.start()
    const effects = flow.choose(0)
    expect(flow.state.wrong).toEqual([0])
    expect(said(effects)).toEqual(['Hör nochmal:', 'rot', 'blau', 'rot', 'blau', 'Was kommt jetzt?'])
    expect(flow.choose(0)).toEqual([])
    flow.choose(1)
    expect(flow.state.results).toEqual([{ ladder: 'muster', firstTry: false }])
    expect(flow.choose(2)).toEqual([])
  })

  it('takes no choice that isn\'t there, and no sorting in a row task', () => {
    const flow = createMusterFlow([ROW], null)
    flow.start()
    expect([flow.choose(7), flow.lift('🐮'), flow.drop(0)]).toEqual([[], [], []])
  })

  it('asks a sort by lighting each basket', () => {
    const effects = createMusterFlow([SORT], null).start()
    expect(said(effects)).toEqual(['Die Tiere kommen hierhin,', 'die Früchte dorthin.', 'Tippe ein Ding an und dann seinen Korb.'])
    expect(lights(effects)).toEqual(['basket-0', 'basket-1'])
    expect(effects.at(-1)).toMatchObject({ ask: true, again: 'Die Tiere kommen hierhin, die Früchte dorthin. Tippe ein Ding an und dann seinen Korb.' })
  })

  it('lifts a thing and says its name; another tap lifts another; a basket with nothing lifted does nothing', () => {
    const flow = createMusterFlow([SORT], null)
    flow.start()
    expect(flow.drop(0)).toEqual([])
    expect(flow.lift('🐮')).toEqual([{ type: 'speak', text: 'Kuh', light: 'thing-🐮' }])
    flow.lift('🍌')
    expect(flow.state.lifted).toBe('🍌')
    expect(flow.lift('🐶')).toEqual([])
  })

  it('puts a thing in the right basket, sends it back from the wrong one', () => {
    const flow = createMusterFlow([SORT, SORT], null)
    flow.start()
    flow.lift('🐮')
    expect(flow.drop(1)).toEqual([{ type: 'back' }, { type: 'speak', text: 'Das gehört in den anderen Korb. Schau nochmal.' }])
    expect(flow.state).toMatchObject({ lifted: null, placed: {}, missed: true })
    flow.lift('🐮')
    expect(flow.drop(0)).toEqual([{ type: 'drop' }])
    expect(flow.state.placed).toEqual({ '🐮': 0 })
    expect(flow.lift('🐮')).toEqual([])
  })

  it('solves a sort when all four are in, right on the first try only without a miss', () => {
    const flow = createMusterFlow([SORT, SORT], null)
    flow.start()
    const put = (id: string, b: 0 | 1) => { flow.lift(id); return flow.drop(b) }
    put('🐮', 0); put('🐷', 0); put('🍌', 1)
    expect(put('🍐', 1)).toEqual([{ type: 'drop' }, { type: 'chime' }, { type: 'speak', text: 'Super!' }])
    expect(flow.state.results).toEqual([{ ladder: 'muster', firstTry: true }])
    expect(flow.lift('🐮')).toEqual([])
    flow.next()
    put('🐮', 1); put('🐮', 0); put('🐷', 0); put('🍌', 1); put('🍐', 1)
    expect(flow.state.results[1]).toEqual({ ladder: 'muster', firstTry: false })
  })

  it('shows a row example, filling the gap as the answer is said, then asks', () => {
    const flow = createMusterFlow([ROW], exampleFor(1, 0))
    const effects = flow.start()
    expect(flow.state.phase).toBe('example')
    expect(said(effects)).toEqual(['Schau:', 'rot', 'blau', 'rot', 'blau', 'Was kommt jetzt?', 'rot!', 'rot', 'blau', 'rot', 'blau', 'rot'])
    expect(effects.findIndex(e => e.type === 'fill') + 1).toBe(effects.findIndex(e => e.type === 'speak' && e.text === 'rot!'))
    expect(effects[0]).toMatchObject({ ask: true, again: 'Schau: rot, blau, rot, blau … Was kommt jetzt? rot!' })
    expect([flow.choose(1), flow.lift('x')]).toEqual([[], []])
    expect(said(flow.exampleDone())).toContain('Was kommt jetzt?')
    expect(flow.state.phase).toBe('asking')
  })

  it('shows a sort example by lighting the baskets', () => {
    const effects = createMusterFlow([SORT], exampleFor(4, 0)).start()
    expect(said(effects)).toEqual(['Die Tiere kommen in diesen Korb,', 'die Früchte in den anderen.', 'Der Hund gehört hierhin!'])
    expect(lights(effects)).toEqual(['basket-0', 'basket-1', 'basket-0'])
  })

  it('gives 10 Stars for five tasks and cheers at the end', () => {
    const flow = createMusterFlow(Array(5).fill(ROW), null)
    flow.start()
    let last: MusterEffect[] = []
    for (let i = 0; i < 5; i++) {
      flow.choose(1)
      last = flow.next()
    }
    expect(flow.state).toMatchObject({ phase: 'done', stars: 10, task: null })
    expect(last).toEqual([{ type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' }])
  })
})
