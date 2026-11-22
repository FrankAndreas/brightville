import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RaumTask } from '@/core/raum'
import { OBJECTS, WORLD_WIDTH } from '@/core/world'
import { hasVoice, instruct, speak } from '@/services/tts'
import { useLaddersStore } from '@/stores/ladders'
import { requestLeave } from '../leave'
import Spielwelt, { PX_PER_UNIT } from '../spielwelt/Spielwelt.vue'
import Welt from './Welt.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string, lang?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return {
    speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }),
    hasVoice: vi.fn(() => true), voiceCount: ref(1),
  }
})

const PLACE: RaumTask = { type: 'place', thing: 'ball', clues: [{ word: 'auf', object: 'tisch' }] }
const FIND: RaumTask = { type: 'find', thing: 'katze', clues: [{ word: 'unter', object: 'bank' }] }
const tisch = OBJECTS.find(o => o.id === 'tisch')!
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const calls = () => vi.mocked(speak).mock.calls as unknown as [string, string?][]

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k),
    clear: () => data.clear(), key: () => null, get length() { return data.size },
  }
}
const viewX = (w: VueWrapper) => Number(w.find('[data-test="world"]').attributes('data-view-x'))
const pointer = (type: string, x: number, y: number) =>
  window.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }))
const px = (w: VueWrapper, x: number, y: number): [number, number] => {
  const d = ((x - viewX(w)) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH
  return [d * PX_PER_UNIT, y * PX_PER_UNIT]
}
async function drag(w: VueWrapper, id: string, to: [number, number]) {
  await w.find(`[data-test="thing-${id}"]`).trigger('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 })
  pointer('pointermove', to[0], to[1])
  pointer('pointerup', to[0], to[1])
  await run(10)
}

describe('the Spielwelt at Oberstufe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(instruct).mockClear()
    vi.mocked(hasVoice).mockImplementation(() => true)
    useLaddersStore().who = 2
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('picks the language, then writes and speaks the instruction in it, with the coach hint once', async () => {
    const w = mount(Welt, { attachTo: document.body })
    await w.find('[data-test="lang-en"]').trigger('click')
    await run(10)
    const written = w.find('[data-test="instruction"]').text()
    expect(written).toMatch(/^(Put the .+\.|The .+ is .+\. Can you find it\?)$/)
    expect(calls().at(-1)).toEqual([written, 'en-GB'])
    expect(instruct).not.toHaveBeenCalled()
    expect(w.find('[data-test="coach-hint"]').text()).toBe('Mach, was der Coach sagt')
    w.unmount()
  })

  it('speaks French in a French voice, and 🔊 repeats it in that voice', async () => {
    const w = mount(Spielwelt, { props: { tasks: [PLACE, FIND], lang: 'fr', storage: memory() }, attachTo: document.body })
    await run(10)
    expect(w.find('[data-test="instruction"]').text()).toBe('Mets le ballon sur la table.')
    vi.mocked(speak).mockClear()
    await w.find('[data-test="say-again"]').trigger('click')
    expect(calls()).toEqual([['Mets le ballon sur la table.', 'fr-FR']])
    w.unmount()
  })

  it('without a voice the instruction is written, there is no 🔊, and play goes on', async () => {
    vi.mocked(hasVoice).mockImplementation(() => false)
    const w = mount(Spielwelt, { props: { tasks: [PLACE, FIND], lang: 'en', storage: memory() }, attachTo: document.body })
    await run(10)
    expect(w.find('[data-test="instruction"]').text()).toBe('Put the ball on the table.')
    expect(w.find('[data-test="say-again"]').exists()).toBe(false)
    await drag(w, 'ball', px(w, tisch.x, (tisch.top ?? 0) - 4))
    await run(4000)
    expect(w.find('[data-test="instruction"]').text()).toBe('The cat is under the bench. Can you find it?')
    expect(w.find('[data-test="coach-hint"]').exists()).toBe(false)
    w.unmount()
  })

  it('gives its Stars and leaves her Raum ladder alone', async () => {
    const ladders = useLaddersStore()
    const record = vi.spyOn(ladders, 'record')
    const w = mount(Spielwelt, { props: { tasks: [PLACE], lang: 'en', storage: memory() }, attachTo: document.body })
    await run(10)
    await drag(w, 'ball', px(w, tisch.x, (tisch.top ?? 0) - 4))
    await run(4000)
    requestLeave()
    await run(10)
    expect((w.emitted('finished')![0][0] as { stars: number }).stars).toBeGreaterThan(0)
    expect(record).not.toHaveBeenCalled()
    w.unmount()
  })

  it('leaving on the language screen ends the visit with no Stars', async () => {
    const w = mount(Welt, { attachTo: document.body })
    requestLeave()
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })
})
