import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { STORIES } from '@/core/stories'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Bibliothek from './Bibliothek.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const STORY = STORIES[0]
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const phase = (w: VueWrapper) => w.find('[data-test="bibliothek"]').attributes('data-phase')
const choices = (w: VueWrapper) => w.findAll('[data-test="choice"]')
const stars = (w: VueWrapper) => w.findAll('[data-test="progress-star"][data-done="true"]').length

async function open(): Promise<VueWrapper> {
  const w = mount(Bibliothek, { props: { story: STORY }, attachTo: document.body })
  await run(10)
  return w
}
/** Long enough for every scene to be read */
const LISTEN = STORY.scenes.length * 5000

describe('Bibliothek', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('reads the story scene by scene, each with its picture', async () => {
    const w = await open()
    expect(phase(w)).toBe('story')
    expect(said()).toEqual([STORY.title, STORY.scenes[0].text])
    expect(w.find('[data-test="scene"]').text()).toBe(STORY.scenes[0].picture)
    await run(5000)
    expect(said()).toContain(STORY.scenes[1].text)
    expect(w.find('[data-test="scene"]').text()).toBe(STORY.scenes[1].picture)
    w.unmount()
  })

  it('reads a scene again on request', async () => {
    const w = await open()
    await w.find('[data-test="again"]').trigger('click')
    expect(said().filter(s => s === STORY.scenes[0].text)).toHaveLength(2)
    w.unmount()
  })

  it('then asks three questions with pictures to tap', async () => {
    const w = await open()
    await run(LISTEN)
    expect(phase(w)).toBe('questions')
    expect(said().at(-1)).toBe(STORY.questions[0].ask)
    expect(choices(w).map(c => c.text())).toEqual(STORY.questions[0].choices.map(c => c.picture))
    expect(w.findAll('[data-test="progress-star"]')).toHaveLength(3)
    w.unmount()
  })

  it('fades a wrong picture and keeps the question; a right one gives a Star and the next question', async () => {
    const w = await open()
    await run(LISTEN)
    const q = STORY.questions[0]
    const wrong = (q.answer + 1) % 3
    await choices(w)[wrong].trigger('click')
    expect(choices(w)[wrong].attributes('data-wrong')).toBe('true')
    expect(stars(w)).toBe(0)
    await choices(w)[q.answer].trigger('click')
    expect(stars(w)).toBe(1)
    expect(said()).toContain(`Richtig! ${q.choices[q.answer].say}.`)
    expect(playBeat).toHaveBeenCalled()
    await run(3000)
    expect(said().at(-1)).toBe(STORY.questions[1].ask)
    w.unmount()
  })

  it('gives 3 Stars per question: 9 for the story, with confetti, then back to the town', async () => {
    const w = await open()
    await run(LISTEN)
    for (const q of STORY.questions) {
      await choices(w)[q.answer].trigger('click')
      await run(3000)
    }
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 9 }]])
    w.unmount()
  })

  it('takes the number keys for the pictures', async () => {
    const w = await open()
    await run(LISTEN)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${STORY.questions[0].answer + 1}` }))
    await run(10)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('keeps the Stars so far when leaving early, once, and nothing goes on after', async () => {
    const w = await open()
    await run(LISTEN)
    await choices(w)[STORY.questions[0].answer].trigger('click')
    requestLeave()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    const before = said().length
    await run(10_000)
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    expect(said()).toHaveLength(before)
    w.unmount()
  })

  it('leaving during the story gives nothing', async () => {
    const w = await open()
    requestLeave()
    await run(LISTEN)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })
})
