import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSchoolStore } from '@/stores/school'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import School, { FLASH_MS } from './School.vue'
import type { Task } from '@/core/numbers'
import { TEST_TASKS, TEST_THINGS } from './testTasks'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const press = (code: string, repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }))
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])

async function open(): Promise<VueWrapper> {
  const w = mount(School, { props: { tasks: TEST_TASKS, things: TEST_THINGS }, attachTo: document.body })
  await run(10)
  return w
}
const choices = (w: VueWrapper) => w.findAll('[data-test="choice"]')
const choice = (w: VueWrapper, value: number) => w.find(`[data-test="choice"][data-value="${value}"]`)
const doneStars = (w: VueWrapper) => w.findAll('[data-test="progress-star"][data-done="true"]').length
/** Long enough for the cheer and the pause before the next task */
const CHEER = 1000

describe('School', () => {
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

  it('shows the objects and three choices and speaks the question', async () => {
    const w = await open()
    expect(said()).toEqual(['Wie viele Äpfel?'])
    expect(w.findAll('[data-test="thing"]')).toHaveLength(3)
    expect(choices(w).map(c => c.attributes('data-value'))).toEqual(['2', '3', '4'])
    expect(w.findAll('[data-test="progress-star"]')).toHaveLength(5)
    expect(doneStars(w)).toBe(0)
    w.unmount()
  })

  it('counts aloud when the child points at objects, each only once', async () => {
    const w = await open()
    const things = w.findAll('[data-test="thing"]')
    await things[1].trigger('pointerdown')
    await things[1].trigger('pointerdown')
    await things[0].trigger('pointerdown')
    expect(said().slice(1)).toEqual(['eins', 'zwei'])
    expect(things[1].attributes('data-counted')).toBe('true')
    expect(things[2].attributes('data-counted')).toBe('false')
    w.unmount()
  })

  it('answers with the digit key', async () => {
    const w = await open()
    press('Digit3')
    await run(CHEER)
    expect(said()).toContain('Super! Drei!')
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(doneStars(w)).toBe(1)
    expect(said().at(-1)).toBe('Wie viele Punkte?')
    w.unmount()
  })

  it('ignores digits that are not offered', async () => {
    const w = await open()
    press('Digit7')
    await run(CHEER)
    expect(said()).toEqual(['Wie viele Äpfel?'])
    w.unmount()
  })

  it('moves the focus with the arrows, says the number, and answers with Enter', async () => {
    const w = await open()
    press('Enter')
    await run(10)
    expect(doneStars(w)).toBe(0)
    press('ArrowRight')
    await run(10)
    expect(choices(w)[0].attributes('data-focus')).toBe('true')
    expect(said().at(-1)).toBe('zwei')
    press('ArrowRight')
    await run(10)
    expect(choices(w)[1].attributes('data-focus')).toBe('true')
    expect(said().at(-1)).toBe('drei')
    press('ArrowLeft')
    press('ArrowLeft')
    await run(10)
    expect(choices(w)[0].attributes('data-focus')).toBe('true')
    press('ArrowRight')
    press('Enter')
    await run(CHEER)
    expect(doneStars(w)).toBe(1)
    w.unmount()
  })

  it('skips a faded answer with the arrows', async () => {
    const w = await open()
    press('Digit2')
    await run(4000)
    press('ArrowRight')
    await run(10)
    expect(choices(w)[1].attributes('data-focus')).toBe('true')
    press('ArrowLeft')
    await run(10)
    expect(choices(w)[1].attributes('data-focus')).toBe('true')
    expect(choices(w)[0].attributes('data-focus')).toBe('false')
    w.unmount()
  })

  it('takes the focus off an answer that turned out wrong', async () => {
    const w = await open()
    press('ArrowRight')
    press('Enter')
    await run(4000)
    expect(choices(w)[0].attributes('data-wrong')).toBe('true')
    expect(choices(w)[0].attributes('data-focus')).toBe('false')
    press('Enter')
    await run(CHEER)
    expect(doneStars(w)).toBe(0)
    w.unmount()
  })

  it('answers with a click', async () => {
    const w = await open()
    await choice(w, 3).trigger('pointerdown')
    await run(CHEER)
    expect(doneStars(w)).toBe(1)
    w.unmount()
  })

  it('counts along after a wrong answer and then accepts the right one', async () => {
    const w = await open()
    press('Digit4')
    await run(10)
    expect(choice(w, 4).attributes('data-wrong')).toBe('true')
    expect(said().at(-1)).toBe('Hmm, zähl nochmal mit mir')
    expect(doneStars(w)).toBe(0)
    // one object lights up every 700 ms with its number
    await run(700 * 3 + 100)
    expect(said().slice(-3)).toEqual(['eins', 'zwei', 'drei'])
    expect(w.findAll('[data-test="thing"][data-counted="true"]')).toHaveLength(3)
    await run(800)
    press('Digit4')
    await run(10)
    expect(said().at(-1)).toBe('drei')
    press('Digit3')
    await run(CHEER)
    expect(doneStars(w)).toBe(1)
    w.unmount()
  })

  it('does not accept answers during the count-along', async () => {
    const w = await open()
    press('Digit4')
    await run(300)
    press('Digit3')
    await run(100)
    expect(doneStars(w)).toBe(0)
    w.unmount()
  })

  it('does not award a task twice for a double key press', async () => {
    const w = await open()
    press('Digit3')
    press('Digit3')
    press('Digit3', true)
    await run(CHEER)
    expect(doneStars(w)).toBe(1)
    // the second task (a die showing 4) is still waiting for its answer
    expect(w.findAll('[data-test="thing"]')).toHaveLength(4)
    w.unmount()
  })

  it('lets the cheer finish when the child taps again during it', async () => {
    // a voice that takes 1.5 s per line, like a real one
    vi.mocked(speak).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1500)))
    const w = await open()
    press('Digit3')
    await run(800)
    press('Digit3')
    await choice(w, 3).trigger('pointerdown')
    await run(600)
    // 1.4 s in: still cheering, the next question has not been asked
    expect(said().at(-1)).toBe('Super! Drei!')
    await run(700)
    expect(said().at(-1)).toBe('Wie viele Punkte?')
    expect(said().filter(t => t === 'Wie viele Punkte?')).toHaveLength(1)
    vi.mocked(speak).mockImplementation(() => Promise.resolve())
    w.unmount()
  })

  it('keeps the bonus when the child leaves during the last cheer', async () => {
    const w = await open()
    for (const task of TEST_TASKS.slice(0, 4)) {
      press(`Digit${task.answer}`)
      await run(CHEER)
    }
    press(`Digit${TEST_TASKS[4].answer}`)
    await run(10)
    press('Escape')
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    w.unmount()
  })

  it('shows a die with countable pips and a sum as two groups', async () => {
    const w = await open()
    press('Digit3')
    await run(CHEER)
    expect(w.find('[data-test="die"]').exists()).toBe(true)
    expect(w.findAll('[data-test="thing"]')).toHaveLength(4)
    press('Digit4')
    await run(CHEER)
    expect(w.findAll('[data-test="group"]')).toHaveLength(2)
    expect(w.findAll('[data-test="thing"]')).toHaveLength(3)
    expect(said().at(-1)).toBe('ein Apfel und zwei Äpfel. Wie viele zusammen?')
    w.unmount()
  })

  it('finishes with 10 stars after five right answers', async () => {
    const w = await open()
    for (const task of TEST_TASKS) {
      press(`Digit${task.answer}`)
      await run(CHEER)
    }
    expect(doneStars(w)).toBe(5)
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    expect(said().at(-1)).toBe('Super gemacht!')
    expect(w.emitted('finished')).toBeUndefined()
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    w.unmount()
  })

  it('leaves by the button during a cheer with the stars so far', async () => {
    const w = await open()
    press('Digit3')
    await run(10)
    requestLeave()
    requestLeave()
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('leaves on Escape with the stars so far and stops all timers', async () => {
    const w = await open()
    press('Digit3')
    await run(CHEER)
    press('Digit5')
    await run(100)
    press('Escape')
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    const spoken = said().length
    await run(10000)
    expect(said().length).toBe(spoken)
    expect(w.emitted('finished')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('stops everything when the screen goes away', async () => {
    const w = await open()
    press('Digit4')
    await run(100)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('the ladders\' tasks', () => {
    const openWith = async (tasks: Task[]) => {
      const w = mount(School, { props: { tasks, things: TEST_THINGS }, attachTo: document.body })
      await run(10)
      return w
    }

    it('shows a quick look\'s dots, then hides them', async () => {
      const w = await openWith([{ type: 'flash', ladder: 'zaehlen', kind: 0, amount: 4, answer: 4, choices: [3, 4, 5] }])
      expect(w.findAll('[data-test="flash-dot"]')).toHaveLength(4)
      await run(FLASH_MS + 10)
      expect(w.findAll('[data-test="flash-dot"]')).toHaveLength(0)
      expect(w.find('[data-test="flash-cover"]').exists()).toBe(true)
    })

    it('shows the dots again when counting along after a wrong answer', async () => {
      const w = await openWith([{ type: 'flash', ladder: 'zaehlen', kind: 0, amount: 4, answer: 4, choices: [3, 4, 5] }])
      await run(FLASH_MS + 10)
      await choice(w, 3).trigger('pointerdown')
      await run(10)
      expect(w.findAll('[data-test="flash-dot"]')).toHaveLength(4)
    })

    it('shows tens bars and ones', async () => {
      const w = await openWith([{ type: 'bars', ladder: 'zaehlen', kind: 0, amount: 34, answer: 34, choices: [33, 34, 35] }])
      expect(w.findAll('[data-test="bar"]')).toHaveLength(3)
      expect(w.findAll('[data-test="one"]')).toHaveLength(4)
      await w.findAll('[data-test="bar"]')[0].trigger('pointerdown')
      expect(said()).toContain('zehn')
    })

    it('crosses out what goes away', async () => {
      const w = await openWith([{ type: 'minus', ladder: 'rechnen', kind: 0, a: 5, b: 2, answer: 3, choices: [2, 3, 4] }])
      expect(w.findAll('[data-test="thing"]')).toHaveLength(5)
      expect(w.findAll('[data-test="thing"][data-gone="true"]')).toHaveLength(2)
    })

    it('shows tens sums as bars', async () => {
      const w = await openWith([{ type: 'plus', ladder: 'rechnen', kind: 0, a: 32, b: 15, bars: true, answer: 47, choices: [46, 47, 48] }])
      expect(w.findAll('[data-test="bar"]')).toHaveLength(4)
      expect(w.findAll('[data-test="one"]')).toHaveLength(7)
    })

    it('shows the numbers said when counting on', async () => {
      const w = await openWith([{ type: 'next', ladder: 'zaehlen', kind: 0, from: 2, by: 1, shown: [2, 3, 4], answer: 5, choices: [4, 5, 6] }])
      expect(said()).toEqual(['Zähl weiter: zwei, drei, vier … und dann?'])
      expect(w.findAll('[data-test="said"]').map(n => n.text())).toEqual(['2', '3', '4'])
    })

    it('lays out twenty things to count', async () => {
      const w = await openWith([{ type: 'count', ladder: 'zaehlen', kind: 0, amount: 20, answer: 20, choices: [19, 20, 18] }])
      expect(w.findAll('[data-test="thing"]')).toHaveLength(20)
    })

    it('answers a big number with the arrow keys and Enter', async () => {
      const w = await openWith([{ type: 'bars', ladder: 'zaehlen', kind: 0, amount: 45, answer: 45, choices: [44, 45, 46] }])
      press('ArrowRight')
      press('ArrowRight')
      press('Enter')
      await run(10)
      expect(w.find('[data-test="progress-star"][data-done="true"]').exists()).toBe(true)
    })
  })

  describe('at her steps', () => {
    it('asks the visit\'s Zählen tasks at her step', () => {
      const school = useSchoolStore()
      school.ladders = { zaehlen: { step: 3, window: [] }, rechnen: { step: 4, window: [] } }
      const kinds = new Set<string>()
      for (let i = 0; i < 30; i++) {
        const w = mount(School, { props: { things: TEST_THINGS } })
        const tasks = (w.vm as unknown as { tasks: Task[] }).tasks
        for (const t of tasks) {
          kinds.add(t.type)
          expect(t.answer).toBeLessThanOrEqual(20)
        }
        w.unmount()
      }
      expect(kinds.has('next') || kinds.has('flash')).toBe(true)
      expect(kinds.has('count')).toBe(false)
    })

    it('records the answered tasks when she leaves', async () => {
      const school = useSchoolStore()
      const w = await open()
      await choice(w, 3).trigger('pointerdown')
      await run(CHEER)
      await choice(w, 5).trigger('pointerdown')
      await run(10)
      requestLeave()
      await run(10)
      // Two right Zählen answers (the second after a wrong one is still to come: not solved, not counted)
      expect(school.ladders.zaehlen.window).toEqual([true])
      expect(w.emitted('finished')).toBeTruthy()
    })
  })
})
