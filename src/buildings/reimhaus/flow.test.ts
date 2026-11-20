import { describe, expect, it } from 'vitest'
import { exampleFor, WORDS, type RhymeTask } from '@/core/rhymes'
import { createRhymeFlow } from './flow'

const w = (id: string) => {
  const word = WORDS.find(x => x.id === id)
  if (!word) throw new Error(id)
  return word
}
const rhymeTask = (): RhymeTask => ({ type: 'rhyme', word: w('maus'), choices: [w('haus'), w('fisch')], answer: 'haus' })
const syllableTask = (): RhymeTask => ({ type: 'syllables', word: w('auto'), answer: 2 })
const said = (effects: { type: string; text?: string }[]) => effects.filter(e => e.type === 'speak').map(e => e.text)

describe('the Reimhaus flow', () => {
  it('starts with the example when given, then asks after it', () => {
    const flow = createRhymeFlow([rhymeTask()], exampleFor(1, 0))
    expect(said(flow.start())).toEqual(['Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!'])
    expect(flow.state.phase).toBe('example')
    const asked = flow.exampleDone()
    expect(flow.state.phase).toBe('asking')
    expect(said(asked)).toEqual(['Was reimt sich auf Maus?'])
    expect(asked).toContainEqual({ type: 'name', ids: ['maus', 'haus', 'fisch'] })
  })

  it('asks at once without an example', () => {
    const flow = createRhymeFlow([syllableTask()], null)
    expect(said(flow.start())).toEqual(['Wie viele Silben hat Auto? Trommle mit!'])
    expect(flow.state.phase).toBe('asking')
  })

  it('asks a first sound', () => {
    const task: RhymeTask = { type: 'sound', word: w('sonne'), choices: [w('fisch'), w('sofa'), w('hund')], answer: 'sofa' }
    expect(said(createRhymeFlow([task], null).start())).toEqual(['Was fängt an wie Sonne?'])
  })

  it('cheers a right picture and counts it as a first try', () => {
    const flow = createRhymeFlow([rhymeTask(), rhymeTask()], null)
    flow.start()
    const effects = flow.pick('haus')
    expect(effects[0]).toEqual({ type: 'chime' })
    expect(said(effects)).toEqual(['Maus – Haus! Super!'])
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: 1, solved: 1, results: [{ ladder: 'reimen', firstTry: true }] })
  })

  it('fades a wrong picture, says both words and names the rest; the right one later counts as missed', () => {
    const flow = createRhymeFlow([rhymeTask(), rhymeTask()], null)
    flow.start()
    const effects = flow.pick('fisch')
    expect(flow.state.wrong).toEqual(['fisch'])
    expect(said(effects)).toEqual(['Maus … Fisch. Hör nochmal gut zu.'])
    expect(effects).toContainEqual({ type: 'name', ids: ['maus', 'haus'] })
    expect(effects.some(e => e.type === 'chime')).toBe(false)
    flow.pick('haus')
    expect(flow.state.results).toEqual([{ ladder: 'reimen', firstTry: false }])
  })

  it('takes no faded picture, no unknown one and nothing during the cheer', () => {
    const flow = createRhymeFlow([rhymeTask(), rhymeTask()], null)
    flow.start()
    flow.pick('fisch')
    expect(flow.pick('fisch')).toEqual([])
    expect(flow.pick('bus')).toEqual([])
    flow.pick('haus')
    expect(flow.pick('haus')).toEqual([])
    expect(flow.state.solved).toBe(1)
  })

  it('counts drum beats; done needs one; clear starts over', () => {
    const flow = createRhymeFlow([syllableTask(), syllableTask()], null)
    flow.start()
    expect(flow.done()).toEqual([])
    expect(flow.tap()).toEqual([{ type: 'beat' }])
    flow.tap()
    flow.tap()
    expect(flow.state.beats).toBe(3)
    flow.clear()
    expect(flow.state.beats).toBe(0)
  })

  it('cheers the right count with the drum', () => {
    const flow = createRhymeFlow([syllableTask(), syllableTask()], null)
    flow.start()
    flow.tap()
    flow.tap()
    const effects = flow.done()
    expect(effects).toEqual([{ type: 'chime' }, { type: 'drum', syllables: ['Au', 'to'] }, { type: 'speak', text: 'Super!' }])
    expect(flow.state).toMatchObject({ phase: 'cheering', results: [{ ladder: 'reimen', firstTry: true }] })
  })

  it('replays a wrong count, then lets her try again; the right count later counts as missed', () => {
    const flow = createRhymeFlow([syllableTask(), syllableTask()], null)
    flow.start()
    flow.tap()
    expect(flow.done()).toEqual([{ type: 'speak', text: 'Hör nochmal gut zu:' }, { type: 'drum', syllables: ['Au', 'to'] }])
    expect(flow.state).toMatchObject({ phase: 'replaying', beats: 0 })
    expect(flow.tap()).toEqual([])
    flow.replayDone()
    expect(flow.state.phase).toBe('asking')
    flow.tap()
    flow.tap()
    flow.done()
    expect(flow.state.results).toEqual([{ ladder: 'reimen', firstTry: false }])
  })

  it('takes no tap, pick or done during the example, the cheer or the replay', () => {
    const flow = createRhymeFlow([syllableTask(), syllableTask()], exampleFor(4, 0))
    flow.start()
    expect([flow.tap(), flow.done(), flow.pick('auto')]).toEqual([[], [], []])
    flow.exampleDone()
    flow.tap()
    flow.tap()
    flow.done()
    expect([flow.tap(), flow.done(), flow.clear()]).toEqual([[], [], []])
    expect(flow.exampleDone()).toEqual([])
  })

  it('gives 10 Stars for five tasks and cheers at the end', () => {
    const flow = createRhymeFlow(Array.from({ length: 5 }, rhymeTask), null)
    flow.start()
    let last: { type: string; text?: string }[] = []
    for (let i = 0; i < 5; i++) {
      flow.pick('haus')
      last = flow.next()
    }
    expect(flow.state).toMatchObject({ phase: 'done', stars: 10, task: null })
    expect(last).toEqual([{ type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' }])
  })
})
