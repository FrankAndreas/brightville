import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { exampleFor, WORDS, type RhymeTask } from '@/core/rhymes'
import { playBeat } from '@/services/sound'
import { askedAgain } from '@/services/sayAgain'
import { forgetInstruction, instruction, speak } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { requestLeave } from '../leave'
import Reimhaus from './Reimhaus.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const w = (id: string) => WORDS.find(x => x.id === id) ?? (() => { throw new Error(id) })()
const RHYME: RhymeTask = { type: 'rhyme', word: w('maus'), choices: [w('haus'), w('fisch')], answer: 'haus' }
const COUNT: RhymeTask = { type: 'syllables', word: w('auto'), answer: 2 }
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
/** Long enough for the cheer, the drum and the pause before the next task */
const CHEER = 3000

async function open(tasks: RhymeTask[] = [RHYME, COUNT], example: ReturnType<typeof exampleFor> = null): Promise<VueWrapper> {
  const wrapper = mount(Reimhaus, { props: { tasks, example }, attachTo: document.body })
  await run(10)
  return wrapper
}
const pick = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-test="pick-${id}"]`)

describe('Reimhaus', () => {
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

  it('asks a rhyme, names the pictures in turn and keeps it all for the 🔊 button', async () => {
    const wrapper = await open()
    await run(CHEER)
    expect(wrapper.find('[data-test="word"]').text()).toBe('🐭')
    expect(said()).toEqual(['Was reimt sich auf Maus?', 'Maus', 'Haus', 'Fisch'])
    expect(instruction.value).toBe('Was reimt sich auf Maus? Maus. Haus, Fisch.')
    expect(wrapper.findAll('[data-test^="pick-"]').map(p => p.text())).toEqual(['🏠', '🐟'])
    wrapper.unmount()
  })

  it('lights no picture any more after a tap made while the pictures are named', async () => {
    let finish: () => void = () => {}
    vi.mocked(speak).mockImplementation(text => (text === 'Haus' ? new Promise<void>(r => { finish = r }) : Promise.resolve()))
    const wrapper = await open([RHYME, RHYME])
    await run(1000)
    expect(pick(wrapper, 'haus').attributes('data-lit')).toBe('true')
    await pick(wrapper, 'haus').trigger('pointerdown')
    finish()
    await run(10)
    expect(wrapper.findAll('[data-lit="true"]')).toHaveLength(0)
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    wrapper.unmount()
  })

  it('keeps the 🔊 text to the pictures still there after a wrong one', async () => {
    const three: RhymeTask = { ...RHYME, choices: [w('haus'), w('fisch'), w('hund')] }
    const wrapper = await open([three])
    await run(CHEER)
    await pick(wrapper, 'fisch').trigger('pointerdown')
    await run(CHEER)
    expect(instruction.value).toBe('Was reimt sich auf Maus? Maus. Haus, Hund.')
    wrapper.unmount()
  })

  it('stops naming when 🔊 says it all again', async () => {
    let finish: () => void = () => {}
    vi.mocked(speak).mockImplementation(text => (text === 'Haus' ? new Promise<void>(r => { finish = r }) : Promise.resolve()))
    const wrapper = await open([RHYME])
    await run(1000)
    // 🔊 tapped (SayAgain.vue)
    askedAgain.value++
    finish()
    await run(1000)
    expect(said()).not.toContain('Fisch')
    expect(wrapper.findAll('[data-lit="true"]')).toHaveLength(0)
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    wrapper.unmount()
  })

  it('keeps the example for the 🔊 button', async () => {
    const wrapper = mount(Reimhaus, { props: { tasks: [RHYME], example: exampleFor(1, 0) }, attachTo: document.body })
    // While the example's pictures are named
    await run(10)
    expect(instruction.value).toBe('Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!')
    wrapper.unmount()
  })

  it('says a count again in one go, as it sounds, with the drum lit, and is ready again after', async () => {
    const socke: RhymeTask = { type: 'syllables', word: w('socke'), answer: 2 }
    const wrapper = await open([socke, RHYME])
    await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    await wrapper.find('[data-test="done"]').trigger('pointerdown')
    await run(100)
    expect(said()).toContain('So – ke')
    expect(said()).not.toContain('cke')
    expect(wrapper.find('[data-test="drum"]').attributes('data-lit')).toBe('true')
    await run(CHEER)
    expect(wrapper.find('[data-test="reimhaus"]').attributes('data-phase')).toBe('asking')
    expect(wrapper.find('[data-test="drum"]').attributes('data-lit')).toBe('false')
    wrapper.unmount()
  })

  it('shows at most ten dots however often she drums', async () => {
    const wrapper = await open([COUNT])
    for (let i = 0; i < 25; i++) await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    expect(wrapper.findAll('[data-test="beat"]')).toHaveLength(10)
    wrapper.unmount()
  })

  it('lets go of the solved question, so 🔊 doesn\'t ask it again during the cheer', async () => {
    const wrapper = await open()
    await run(CHEER)
    vi.mocked(forgetInstruction).mockClear()
    await pick(wrapper, 'haus').trigger('pointerdown')
    expect(forgetInstruction).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fades a wrong picture and goes on after the right one', async () => {
    const wrapper = await open()
    await pick(wrapper, 'fisch').trigger('pointerdown')
    await run(10)
    expect(pick(wrapper, 'fisch').attributes('data-faded')).toBe('true')
    expect(said()).toContain('Maus … Fisch. Hör nochmal gut zu.')
    await pick(wrapper, 'haus').trigger('pointerdown')
    expect(playBeat).toHaveBeenCalledWith('chime')
    await run(CHEER)
    expect(said().at(-1)).toBe('Wie viele Silben hat Auto? Trommle mit!')
    expect(wrapper.find('[data-test="drum"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('adds a dot per drum tap, shows ✓ after the first and takes a right count', async () => {
    const wrapper = await open([COUNT, RHYME])
    expect(wrapper.find('[data-test="done"]').exists()).toBe(false)
    await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    expect(wrapper.findAll('[data-test="beat"]')).toHaveLength(2)
    expect(playBeat).toHaveBeenCalledWith('drum')
    await wrapper.find('[data-test="clear"]').trigger('pointerdown')
    expect(wrapper.findAll('[data-test="beat"]')).toHaveLength(0)
    await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    await wrapper.find('[data-test="drum"]').trigger('pointerdown')
    await wrapper.find('[data-test="done"]').trigger('pointerdown')
    await run(CHEER)
    expect(said()).toEqual(expect.arrayContaining(['Au – to', 'Super!']))
    expect(said().slice(said().indexOf('Super!'))).toEqual(['Super!', 'Was reimt sich auf Maus?', 'Maus', 'Haus', 'Fisch'])
    wrapper.unmount()
  })

  it('shows the example first and asks after it', async () => {
    const wrapper = mount(Reimhaus, { props: { tasks: [RHYME, COUNT], example: exampleFor(1, 0) }, attachTo: document.body })
    expect(wrapper.findAll('[data-test="example-word"]').map(e => e.text())).toEqual(['🐭', '🏠'])
    expect(wrapper.find('[data-test="pick-haus"]').exists()).toBe(false)
    await run(CHEER)
    expect(said()[0]).toContain('Das reimt sich!')
    expect(said()).toContain('Was reimt sich auf Maus?')
    wrapper.unmount()
  })

  it('records only answered tasks for the child who started, at the visit\'s step, and gives the Stars', async () => {
    const school = useSchoolStore()
    school.ladders = { ...school.ladders, reimen: { step: 2, window: [] } }
    school.who = 2
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const wrapper = await open()
    await pick(wrapper, 'haus').trigger('pointerdown')
    await run(CHEER)
    // A parent moves her up meanwhile: the answers still belong to step 2
    school.ladders = { ...school.ladders, reimen: { step: 4, window: [] } }
    school.who = 3
    requestLeave()
    await run(10)
    expect(wrapper.emitted('finished')?.[0]).toEqual([{ stars: 1 }])
    expect(record).toHaveBeenCalledWith([{ ladder: 'reimen', firstTry: true }], { reimen: 2 }, 2)
  })

  it('records nothing new when she leaves during the example', async () => {
    const school = useSchoolStore()
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const wrapper = await open([RHYME], exampleFor(1, 0))
    requestLeave()
    await run(10)
    expect(record).toHaveBeenCalledWith([], { reimen: 1 }, null)
    expect(wrapper.emitted('finished')?.[0]).toEqual([{ stars: 0 }])
  })

  it('builds the visit at her Reimen step when no tasks are given', () => {
    const school = useSchoolStore()
    school.ladders = { ...school.ladders, reimen: { step: 3, window: [] } }
    const wrapper = mount(Reimhaus)
    const tasks = (wrapper.vm as unknown as { tasks: RhymeTask[] }).tasks
    expect(tasks.every(t => t.type === 'sound')).toBe(true)
    wrapper.unmount()
  })
})
