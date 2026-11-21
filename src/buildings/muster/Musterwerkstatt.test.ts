import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { exampleFor, type MusterTask, type Piece, type SortThing } from '@/core/patterns'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruction, speak } from '@/services/tts'
import { useLaddersStore } from '@/stores/ladders'
import { requestLeave } from '../leave'
import Musterwerkstatt from './Musterwerkstatt.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const c = (colour: Piece['colour']): Piece => ({ colour, shape: 'kreis', big: true })
const ROW: MusterTask = {
  type: 'row', feature: 'colour', pieces: [c('rot'), c('blau'), c('rot'), c('blau'), c('rot')], gap: 4,
  choices: [c('gelb'), c('rot'), c('gruen')], answer: 1,
}
const thing = (id: string, say: string, basket: 0 | 1): SortThing => ({ id, say, emoji: id, basket })
const SORT: MusterTask = {
  type: 'sort', by: 'kind', baskets: ['Tiere', 'Früchte'],
  examples: [thing('🐶', 'Hund', 0), thing('🍎', 'Apfel', 1)],
  things: [thing('🐮', 'Kuh', 0), thing('🐷', 'Schwein', 0), thing('🍌', 'Banane', 1), thing('🍐', 'Birne', 1)],
}
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(x => x[0])
const CHEER = 4000

async function open(tasks: MusterTask[] = [ROW, SORT], example: ReturnType<typeof exampleFor> = null): Promise<VueWrapper> {
  const w = mount(Musterwerkstatt, { props: { tasks, example }, attachTo: document.body })
  await run(10)
  return w
}
const tap = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).trigger('pointerdown')

describe('Musterwerkstatt', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows a row with its gap and three choices, says it piece by piece and keeps it for 🔊', async () => {
    const w = await open()
    expect(w.findAll('[data-test^="piece-"]')).toHaveLength(4)
    expect(w.find('[data-test="gap"]').exists()).toBe(true)
    expect(w.findAll('[data-test^="choice-"]')).toHaveLength(3)
    await run(CHEER)
    expect(said()).toEqual(['rot', 'blau', 'rot', 'blau', 'Was kommt jetzt?'])
    expect(instruction.value).toBe('rot, blau, rot, blau … Was kommt jetzt?')
    w.unmount()
  })

  it('fades a wrong piece; the right one fills the gap and goes on to the sort', async () => {
    const w = await open()
    await tap(w, 'choice-0')
    await run(10)
    expect(w.find('[data-test="choice-0"]').attributes('data-faded')).toBe('true')
    await tap(w, 'choice-1')
    await run(10)
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(w.find('[data-test="gap"]').attributes('data-filled')).toBe('true')
    await run(CHEER)
    expect(w.find('[data-test="basket-0"]').exists()).toBe(true)
    w.unmount()
  })

  it('sorts by tapping a thing, then a basket; the wrong basket sends it back', async () => {
    const w = await open([SORT, ROW])
    await run(CHEER)
    expect(w.find('[data-test="basket-0"]').text()).toContain('🐶')
    await tap(w, 'thing-🐮')
    expect(w.find('[data-test="thing-🐮"]').attributes('data-lifted')).toBe('true')
    await tap(w, 'basket-1')
    await run(10)
    expect(w.find('[data-test="thing-🐮"]').attributes('data-lifted')).toBe('false')
    expect(said()).toContain('Das gehört in den anderen Korb. Schau nochmal.')
    await tap(w, 'thing-🐮')
    await tap(w, 'basket-0')
    expect(w.find('[data-test="basket-0"]').text()).toContain('🐮')
    expect(w.find('[data-test="thing-🐮"]').exists()).toBe(false)
    w.unmount()
  })

  it('hops a thing back from the wrong basket', async () => {
    const w = await open([SORT, ROW])
    await run(CHEER)
    await tap(w, 'thing-🐮')
    await tap(w, 'basket-1')
    expect(w.find('[data-test="thing-🐮"]').attributes('data-back')).toBe('true')
    await run(1000)
    expect(w.find('[data-test="thing-🐮"]').attributes('data-back')).toBe('false')
    w.unmount()
  })

  it('shows no things to tap during a sort example', async () => {
    const w = mount(Musterwerkstatt, { props: { tasks: [SORT], example: exampleFor(4, 0) }, attachTo: document.body })
    expect(w.find('[data-test="basket-0"]').exists()).toBe(true)
    expect(w.findAll('[data-test^="thing-"]')).toHaveLength(0)
    w.unmount()
  })

  it('lets go of the solved question, so 🔊 doesn\'t ask it again during the cheer', async () => {
    const w = await open()
    await run(CHEER)
    vi.mocked(forgetInstruction).mockClear()
    await tap(w, 'choice-1')
    expect(forgetInstruction).toHaveBeenCalled()
    w.unmount()
  })

  it('shows the example first, filling its gap, then asks', async () => {
    const w = mount(Musterwerkstatt, { props: { tasks: [ROW], example: exampleFor(1, 0) }, attachTo: document.body })
    expect(w.find('[data-test="example"]').exists()).toBe(true)
    await run(CHEER)
    expect(said()).toContain('rot!')
    expect(said().at(-1)).toBe('Was kommt jetzt?')
    expect(w.find('[data-test="example"]').exists()).toBe(false)
    w.unmount()
  })

  it('records only solved tasks for the child who started, at the visit\'s step, and gives the Stars', async () => {
    const school = useLaddersStore()
    school.ladders = { ...school.ladders, muster: { step: 2, window: [] } }
    school.who = 2
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const w = await open()
    await tap(w, 'choice-1')
    await run(CHEER)
    await tap(w, 'thing-🐮')
    school.ladders = { ...school.ladders, muster: { step: 4, window: [] } }
    school.who = 3
    requestLeave()
    await run(10)
    expect(w.emitted('finished')?.[0]).toEqual([{ stars: 1 }])
    expect(record).toHaveBeenCalledWith([{ ladder: 'muster', firstTry: true }], { muster: 2 }, 2)
  })

  it('builds the visit at her Muster step when no tasks are given', () => {
    const school = useLaddersStore()
    school.ladders = { ...school.ladders, muster: { step: 4, window: [] } }
    const w = mount(Musterwerkstatt)
    const tasks = (w.vm as unknown as { tasks: MusterTask[] }).tasks
    expect(tasks.every(t => t.type === 'sort')).toBe(true)
    w.unmount()
  })
})
