import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Bonbonjagd from './Bonbonjagd.vue'
import { MAZE_THEMES } from './themes'

vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const phase = (w: VueWrapper) => w.find('[data-test="bonbonjagd"]').attributes('data-phase')
const key = (k: string, code = k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, cancelable: true }))

const CORRIDOR = ['WWWWWWW', 'WP....W', 'WWWWWWW']
// A chaser right next to the player, with sweets left so the round goes on
const CHASED = ['WWWWWWW', 'WPG...W', 'WWWWWWW', 'W.....W', 'WWWWWWW']

function open(maze?: string[]): VueWrapper {
  // Chasers always take their first way: towards the player in CHASED
  return mount(Bonbonjagd, { props: { theme: MAZE_THEMES[0], maze, random: () => 0 }, attachTo: document.body })
}

describe('Bonbonjagd', () => {
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

  it('has two themes with four chasers each', () => {
    expect(MAZE_THEMES).toHaveLength(2)
    for (const t of MAZE_THEMES) expect(t.chasers).toHaveLength(4)
  })

  it('takes one of the mazes when none is given, and waits for the first direction', async () => {
    const w = open()
    await run(1000)
    expect(phase(w)).toBe('ready')
    expect(said()[0]).toBe(MAZE_THEMES[0].say)
    expect(w.findAll('[data-test="life"]')).toHaveLength(5)
    key('ArrowLeft')
    await run(10)
    expect(phase(w)).toBe('playing')
    w.unmount()
  })

  it('cheers when every sweet is eaten and goes back to the town', async () => {
    const w = open(CORRIDOR)
    await w.find('[data-test="arrow"][data-dir="right"]').trigger('pointerdown')
    await run(1500)
    expect(phase(w)).toBe('won')
    expect(said()).toContain('Geschafft!')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    expect(w.emitted('finished')).toBeUndefined()
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('says "Hoppla!" for a lost life, rests a moment and goes on', async () => {
    const w = open(CHASED)
    key('ArrowRight')
    // Both move towards each other: they touch within a few frames
    for (let i = 0; i < 20 && phase(w) !== 'hoppla'; i++) await run(16)
    expect(phase(w)).toBe('hoppla')
    expect(said().at(-1)).toBe('Hoppla!')
    expect(w.findAll('[data-test="life"]')).toHaveLength(4)
    await run(1450)
    expect(phase(w)).toBe('hoppla')
    // Just after the pause, before the chaser can reach the player again
    await run(80)
    expect(phase(w)).toBe('playing')
    w.unmount()
  })

  it('ends after the last life and goes back to the town', async () => {
    const w = open(CHASED)
    key('ArrowRight')
    for (let i = 0; i < 5; i++) await run(1600)
    expect(phase(w)).toBe('over')
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('goes back to the town at once with Esc or the leave button, once, and leaves nothing running', async () => {
    const w = open(CHASED)
    key('ArrowRight')
    await run(200)
    requestLeave()
    key('Escape')
    await run(10_000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(said().filter(s => s === 'Hoppla!')).toHaveLength(1)
    w.unmount()
  })
})
