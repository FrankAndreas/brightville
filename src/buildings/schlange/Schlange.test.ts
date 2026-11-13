import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { SnakeState } from '@/core/snake'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Schlange from './Schlange.vue'
import { SNAKE_THEMES } from './themes'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const phase = (w: VueWrapper) => w.find('[data-test="schlange"]').attributes('data-phase')
const key = (k: string, code = k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, cancelable: true }))

// Heading down into its own body: crashes on the first step
const crashing = (): SnakeState => ({
  snake: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
  dir: 'down', nextDir: 'down', items: [], kinds: ['⭐'], collected: 4, over: false,
})

function open(snake?: SnakeState): VueWrapper {
  return mount(Schlange, { props: { theme: SNAKE_THEMES[0], snake }, attachTo: document.body })
}

describe('Schlange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext as never)
    vi.mocked(speak).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('has two themes, each with a face and things to collect', () => {
    expect(SNAKE_THEMES).toHaveLength(2)
    for (const t of SNAKE_THEMES) expect(t.face && t.items.length && t.say).toBeTruthy()
  })

  it('waits for the first direction, then moves', async () => {
    const w = open()
    await run(1000)
    expect(phase(w)).toBe('ready')
    expect(said()[0]).toBe(SNAKE_THEMES[0].say)
    key('ArrowLeft')
    await run(10)
    expect(phase(w)).toBe('playing')
    await run(600)
    expect(Number(w.find('[data-test="head"]').attributes('data-x'))).toBeLessThan(7)
    w.unmount()
  })

  it('starts and turns with the arrow pad', async () => {
    const w = open()
    await w.find('[data-test="arrow"][data-dir="right"]').trigger('pointerdown')
    expect(phase(w)).toBe('playing')
    await run(600)
    expect(Number(w.find('[data-test="head"]').attributes('data-x'))).toBeGreaterThan(7)
    w.unmount()
  })

  it('ends the round on a crash, says how many, and goes back to the town', async () => {
    const w = open(crashing())
    key('ArrowDown')
    await run(400)
    expect(phase(w)).toBe('over')
    expect(said().at(-1)).toBe('Oh! Du hast vier Schätze gesammelt.')
    expect(w.emitted('finished')).toBeUndefined()
    // Turning now does nothing
    key('ArrowUp')
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('goes back to the town at once with Esc or the leave button, once', async () => {
    const w = open()
    key('ArrowLeft')
    await run(300)
    requestLeave()
    key('Escape')
    await run(5000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('stops moving while the page is hidden', async () => {
    const w = open()
    key('ArrowLeft')
    await run(300)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    const x = w.find('[data-test="head"]').attributes('data-x')
    await run(3000)
    expect(w.find('[data-test="head"]').attributes('data-x')).toBe(x)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    w.unmount()
  })
})
