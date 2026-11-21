import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { exampleFor, type Activity, type Choice, type ZeitTask } from '@/core/kalender'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruction, speak } from '@/services/tts'
import { useLaddersStore } from '@/stores/ladders'
import { requestLeave } from '../leave'
import Kalender from './Kalender.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const act = (id: string): Activity => ({ id, say: id, emoji: id })
const ITEMS = ['aufstehen', 'fruehstuecken', 'mittagessen', 'schlafen'].map(act)
const ORDER: ZeitTask = { type: 'order', items: ITEMS, shown: [ITEMS[2], ITEMS[0], ITEMS[3], ITEMS[1]] }
const day = (d: number, say: string): Choice => ({ id: `day-${d}`, say, kind: 'day', day: d })
const DAY: ZeitTask = { type: 'pick', topic: 'day', question: 'Heute ist Donnerstag. Was war gestern?', choices: [day(4, 'Freitag'), day(2, 'Mittwoch'), day(6, 'Sonntag')], answer: 'day-2', focus: 3, aboutToday: true }
const WEEK: ZeitTask = { ...DAY, question: 'Was kommt nach Montag?', answer: 'day-1', choices: [day(4, 'Freitag'), day(1, 'Dienstag'), day(6, 'Sonntag')], focus: 0, aboutToday: false }
const clock = (hour: number, half: boolean): Choice => ({ id: `clock-${hour}-${half ? 30 : 0}`, say: '', kind: 'clock', clock: { hour, half } })
const CLOCK: ZeitTask = { type: 'pick', topic: 'clock', question: 'Welche Uhr zeigt drei Uhr?', choices: [clock(3, true), clock(3, false), clock(4, false)], answer: 'clock-3-0' }
const THURSDAY = new Date(2026, 10, 19)
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(x => x[0])
const CHEER = 4000

async function open(tasks: ZeitTask[], example: ReturnType<typeof exampleFor> = null): Promise<VueWrapper> {
  const w = mount(Kalender, { props: { tasks, example, today: THURSDAY }, attachTo: document.body })
  await run(10)
  return w
}
const tap = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).trigger('pointerdown')

describe('Kalender', () => {
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

  it('fills the places of a day in order; a picture tapped too early wiggles', async () => {
    const w = await open([ORDER, DAY])
    await tap(w, 'item-schlafen')
    expect(w.find('[data-test="item-schlafen"]').attributes('data-wiggle')).toBe('true')
    await tap(w, 'item-aufstehen')
    expect(w.find('[data-test="slot-0"]').text()).toBe('aufstehen')
    expect(w.find('[data-test="item-aufstehen"]').exists()).toBe(false)
    for (const id of ['fruehstuecken', 'mittagessen', 'schlafen']) await tap(w, `item-${id}`)
    expect(playBeat).toHaveBeenCalledWith('chime')
    await run(CHEER)
    expect(said()).toContain('Zuerst aufstehen, dann fruehstuecken, dann mittagessen, dann schlafen.')
    w.unmount()
  })

  it('shows the week with today\'s sun and three named day cards', async () => {
    const w = await open([DAY])
    expect(w.findAll('[data-test^="strip-"]')).toHaveLength(7)
    expect(w.find('[data-test="strip-3"]').attributes('data-today')).toBe('true')
    expect(w.find('[data-test="strip-2"]').attributes('data-today')).toBe('false')
    expect(w.findAll('[data-test^="choice-"]')).toHaveLength(3)
    await run(CHEER)
    expect(said()).toEqual(['Heute ist Donnerstag. Was war gestern?', 'Freitag', 'Mittwoch', 'Sonntag'])
    expect(instruction.value).toBe('Heute ist Donnerstag. Was war gestern? Freitag, Mittwoch, Sonntag.')
    await tap(w, 'choice-day-4')
    expect(w.find('[data-test="choice-day-4"]').attributes('data-faded')).toBe('true')
    vi.mocked(forgetInstruction).mockClear()
    await tap(w, 'choice-day-2')
    expect(forgetInstruction).toHaveBeenCalled()
    w.unmount()
  })

  it('shows no sun on the week when the question isn\'t about today, and lights a named card\'s day', async () => {
    let finish: () => void = () => {}
    vi.mocked(speak).mockImplementation(text => (text === 'Freitag' ? new Promise<void>(r => { finish = r }) : Promise.resolve()))
    const w = await open([WEEK])
    expect(w.find('[data-test="strip-3"]').attributes('data-today')).toBe('false')
    await run(500)
    expect(w.find('[data-test="strip-4"]').attributes('data-lit')).toBe('true')
    expect(w.find('[data-test="choice-day-4"]').attributes('data-lit')).toBe('true')
    finish()
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    w.unmount()
  })

  it('says a day of the week when she taps it, while she is asked, and nothing else', async () => {
    const w = await open([WEEK])
    await run(CHEER)
    vi.mocked(speak).mockClear()
    let finish: () => void = () => {}
    vi.mocked(speak).mockImplementation(() => new Promise<void>(r => { finish = r }))
    await tap(w, 'strip-5')
    expect(said()).toEqual(['Samstag'])
    expect(w.find('[data-test="strip-5"]').attributes('data-lit')).toBe('true')
    finish()
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    await run(10)
    expect(w.find('[data-test="strip-5"]').attributes('data-lit')).toBe('false')
    expect(w.find('[data-test="choice-day-4"]').attributes('data-faded')).not.toBe('true')
    w.unmount()
  })

  it('keeps 🔊 to the cards still there when a tapped day cuts off the question after a wrong card', async () => {
    const w = await open([WEEK])
    await run(CHEER)
    let finish: () => void = () => {}
    vi.mocked(speak).mockImplementation(text => (text === 'Hör nochmal gut zu.' ? new Promise<void>(r => { finish = r }) : Promise.resolve()))
    await tap(w, 'choice-day-4')
    await tap(w, 'strip-5')
    finish()
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    await run(10)
    expect(instruction.value).toBe('Was kommt nach Montag? Dienstag, Sonntag.')
    w.unmount()
  })

  it('says no day for a tap on the week during the example', async () => {
    const w = await open([WEEK], exampleFor(3, 0, THURSDAY))
    vi.mocked(speak).mockClear()
    await tap(w, 'strip-5')
    expect(said()).not.toContain('Samstag')
    w.unmount()
  })

  it('shows the example\'s pictures as not to be tapped', () => {
    const w = mount(Kalender, { props: { tasks: [ORDER], example: exampleFor(1, 0, THURSDAY), today: THURSDAY }, attachTo: document.body })
    expect(w.find('.loose').attributes('data-shown-only')).toBe('true')
    w.unmount()
  })

  it('shows three clocks with their hands', async () => {
    const w = await open([CLOCK])
    expect(w.findAll('[data-test="clock-face"]')).toHaveLength(3)
    expect(w.find('[data-test="choice-clock-3-30"] [data-test="clock-face"]').attributes('data-time')).toBe('3:30')
    w.unmount()
  })

  it('shows the example first and asks after it', async () => {
    const w = mount(Kalender, { props: { tasks: [DAY], example: exampleFor(4, 0, THURSDAY), today: THURSDAY }, attachTo: document.body })
    expect(w.find('[data-test="example"]').exists()).toBe(true)
    expect(w.findAll('[data-test^="choice-"]')).toHaveLength(0)
    await run(CHEER)
    expect(said().slice(0, 3)).toEqual(['Heute ist Donnerstag.', 'Gestern war Mittwoch.', 'Morgen ist Freitag.'])
    expect(w.find('[data-test="example"]').exists()).toBe(false)
    w.unmount()
  })

  it('keeps its "heute" through midnight: the day is read when the visit starts', async () => {
    const w = await open([DAY])
    vi.setSystemTime(new Date(2026, 10, 20, 0, 5))
    await run(10)
    expect(w.find('[data-test="strip-3"]').attributes('data-today')).toBe('true')
    w.unmount()
  })

  it('records only solved tasks for the child who started, at the visit\'s step, and gives the Stars', async () => {
    const school = useLaddersStore()
    school.ladders = { ...school.ladders, zeit: { step: 3, window: [] } }
    school.who = 2
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const w = await open([DAY, CLOCK])
    await tap(w, 'choice-day-2')
    await run(CHEER)
    school.ladders = { ...school.ladders, zeit: { step: 5, window: [] } }
    school.who = 3
    requestLeave()
    await run(10)
    expect(w.emitted('finished')?.[0]).toEqual([{ stars: 1 }])
    expect(record).toHaveBeenCalledWith([{ ladder: 'zeit', firstTry: true }], { zeit: 3 }, 2)
  })

  it('builds the visit at her Zeit step when no tasks are given', () => {
    const school = useLaddersStore()
    school.ladders = { ...school.ladders, zeit: { step: 2, window: [] } }
    const w = mount(Kalender)
    const tasks = (w.vm as unknown as { tasks: ZeitTask[] }).tasks
    expect(tasks.every(t => t.type === 'pick' && t.topic === 'time')).toBe(true)
    w.unmount()
  })
})
