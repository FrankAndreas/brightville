import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { COLORS, MIXES, type LabTask } from '@/core/colorMixes'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Farblabor from './Farblabor.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

// Five mixes, the right colour always second
const TASKS: LabTask[] = MIXES.slice(0, 5).map(mix => {
  const other = MIXES.filter(m => m.result !== mix.result).map(m => m.result)
  return { mix, choices: [other[0], mix.result, other[1]], answer: 1 }
})
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const choices = (w: VueWrapper) => w.findAll('[data-test="choice"]')
const stars = (w: VueWrapper) => w.findAll('[data-test="progress-star"][data-done="true"]').length
const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

async function open(): Promise<VueWrapper> {
  const w = mount(Farblabor, { props: { tasks: TASKS }, attachTo: document.body })
  await run(10)
  return w
}

describe('Farblabor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows two pots and asks what they make, with three colours to pick', async () => {
    const w = await open()
    const pots = w.findAll('[data-test="pot"]').map(p => p.attributes('data-color'))
    expect(pots).toEqual(['rot', 'gelb'])
    expect(said().at(-1)).toBe('Rot und Gelb. Was gibt das?')
    expect(choices(w).map(c => c.attributes('data-color'))).toEqual(TASKS[0].choices)
    expect(w.findAll('[data-test="progress-star"]')).toHaveLength(5)
    w.unmount()
  })

  it('fades a wrong colour and keeps the question', async () => {
    const w = await open()
    await choices(w)[0].trigger('click')
    expect(choices(w)[0].attributes('data-wrong')).toBe('true')
    expect(stars(w)).toBe(0)
    expect(said().at(-1)).toBe('Schau nochmal!')
    w.unmount()
  })

  it('fills the bowl with the right colour, says it, and asks the next', async () => {
    const w = await open()
    await choices(w)[1].trigger('click')
    expect(w.find('[data-test="bowl"]').attributes('data-color')).toBe('orange')
    expect(said()).toContain(`${COLORS.orange.name}!`)
    expect(playBeat).toHaveBeenCalled()
    expect(stars(w)).toBe(1)
    await run(3000)
    expect(w.findAll('[data-test="pot"]').map(p => p.attributes('data-color'))).toEqual(['blau', 'gelb'])
    w.unmount()
  })

  it('takes the number keys 1 to 3', async () => {
    const w = await open()
    press('Digit2')
    await run(10)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('gives 2 Stars per mix: 10 for all five, with confetti, then back to the town', async () => {
    const w = await open()
    for (let i = 0; i < 5; i++) {
      await choices(w)[1].trigger('click')
      await run(3000)
    }
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    w.unmount()
  })

  it('keeps the Stars so far when leaving early, once', async () => {
    const w = await open()
    await choices(w)[1].trigger('click')
    await run(3000)
    await choices(w)[1].trigger('click')
    requestLeave()
    press('Escape')
    await run(5000)
    expect(w.emitted('finished')).toEqual([[{ stars: 4 }]])
    w.unmount()
  })
})
