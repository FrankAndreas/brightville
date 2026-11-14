import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { instruction, speak } from '@/services/tts'
import { useWardrobeStore } from '@/stores/wardrobe'
import { requestLeave } from '../leave'
import Flatterflug from './Flatterflug.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

// No WebGL in tests: a stand-in for the flying wobbly that records what the game asks of it
const flyer = vi.hoisted(() => ({
  setDress: vi.fn(), flap: vi.fn(), draw: vi.fn(), hover: vi.fn(), resize: vi.fn(), dispose: vi.fn(), wings: [],
}))
vi.mock('@/city/flyer', () => ({ createFlyer: () => flyer }))

const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const phase = (w: VueWrapper) => w.find('[data-test="flatterflug"]').attributes('data-phase')
const hearts = (w: VueWrapper) => w.findAll('[data-test="heart"]').length
const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
const tap = (w: VueWrapper) => w.find('[data-test="sky"]').trigger('pointerdown')

const WELCOME = 'Tipp, dann flattert dein Wobbel los! Flieg durch die Lücken zwischen den Wolken. '
  + 'Wie schnell willst du sein? Tipp auf ein Tier.'

function open(props: Record<string, unknown> = {}): VueWrapper {
  // Every gap in the middle; nobody taps after the first one, so the wobbly rests on the meadow, below every gap
  return mount(Flatterflug, { props: { random: () => 0.5, owner: 7, ...props }, attachTo: document.body })
}

describe('Flatterflug', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext as never)
    vi.mocked(speak).mockClear()
    for (const f of Object.values(flyer)) if (typeof f === 'function') f.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('says what to do, lets the wobbly hover, and starts with the first tap', async () => {
    const w = open()
    await run(500)
    expect(said()[0]).toBe(WELCOME)
    expect(phase(w)).toBe('ready')
    expect(hearts(w)).toBe(3)
    expect(flyer.hover).toHaveBeenLastCalledWith(true)
    await tap(w)
    await run(50)
    expect(phase(w)).toBe('playing')
    expect(flyer.flap).toHaveBeenCalledTimes(1)
    expect(flyer.hover).toHaveBeenLastCalledWith(false)
    // The speed is chosen: from now on the 🔊 says the goal
    expect(instruction.value).toBe('Tipp, dann flattert dein Wobbel! Flieg durch die Lücken zwischen den Wolken.')
    w.unmount()
  })

  it('flaps with the space bar and the up arrow too', async () => {
    const w = open()
    key('Space')
    key('ArrowUp')
    await run(50)
    expect(flyer.flap).toHaveBeenCalledTimes(2)
    expect(phase(w)).toBe('playing')
    w.unmount()
  })

  it('leaves Space to a button that has the focus', async () => {
    const w = open()
    const button = w.find('[data-test="speed"][data-speed="mittel"]').element as HTMLButtonElement
    button.focus()
    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }))
    await run(50)
    expect(flyer.flap).not.toHaveBeenCalled()
    w.unmount()
  })

  it('wears her look and what she wears', async () => {
    const wardrobe = useWardrobeStore()
    const w = open()
    expect(flyer.setDress).toHaveBeenCalledWith(wardrobe.dress)
    w.unmount()
  })

  it('lets her pick the speed before the start, and keeps it for next time', async () => {
    const w = open()
    expect(w.find('[data-test="speed"][data-chosen="true"]').attributes('data-speed')).toBe('langsam')
    await w.find('[data-test="speed"][data-speed="schnell"]').trigger('click')
    expect(said().at(-1)).toBe('Schnell')
    w.unmount()
    const again = open()
    expect(again.find('[data-test="speed"][data-chosen="true"]').attributes('data-speed')).toBe('schnell')
    // A tap on a speed is no flap
    expect(flyer.flap).not.toHaveBeenCalled()
    await tap(again)
    expect(again.find('[data-test="speed"]').exists()).toBe(false)
    again.unmount()
  })

  it('says "Hoppla!" when a cloud costs a heart, and flies on', async () => {
    const w = open()
    await tap(w)
    await run(9000)
    expect(said()).toContain('Hoppla!')
    expect(hearts(w)).toBe(2)
    expect(phase(w)).toBe('playing')
    w.unmount()
  })

  it('counts the gates she got through', async () => {
    const w = open()
    await tap(w)
    expect(w.find('[data-test="passed"]').text()).toBe('0 / 15')
    // The first gate goes by after about 7 s, the next after about 11 s
    await run(9000)
    expect(w.find('[data-test="passed"]').text()).toBe('1 / 15')
    w.unmount()
  })

  it('cheers after the last gate and goes back to the town', async () => {
    const w = open({ toWin: 1 })
    await tap(w)
    await run(12000)
    expect(phase(w)).toBe('won')
    expect(said()).toContain('Geschafft!')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('comforts her when the last heart is gone, and goes back to the town', async () => {
    const w = open({ startSpeed: 'schnell' })
    await tap(w)
    await run(60000)
    expect(phase(w)).toBe('over')
    expect(said()).toContain('Oh! Das nächste Mal klappt es.')
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('leaves with Escape or the leave button, and lets go of the wobbly', async () => {
    const w = open()
    key('Escape')
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
    expect(flyer.dispose).toHaveBeenCalled()
    const again = open()
    requestLeave()
    expect(again.emitted('finished')).toEqual([[{ stars: 0 }]])
    again.unmount()
  })
})
