import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RaumTask } from '@/core/raum'
import { CAR, GROUND, OBJECTS, placeFor, WORLD_WIDTH } from '@/core/world'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { requestLeave } from '../leave'
import Spielwelt, { PX_PER_UNIT } from './Spielwelt.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const PLACE: RaumTask = { type: 'place', thing: 'ball', clues: [{ word: 'auf', object: 'tisch' }] }
const FIND: RaumTask = { type: 'find', thing: 'katze', clues: [{ word: 'unter', object: 'bank' }] }
const tisch = OBJECTS.find(o => o.id === 'tisch')!
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(x => x[0])
const CHEER = 3000
const KEY = 'brightville.spielwelt.2'

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k),
    clear: () => data.clear(), key: () => null, get length() { return data.size },
  }
}

let storage: Storage
async function open(tasks: RaumTask[], extra: Record<string, unknown> = {}): Promise<VueWrapper> {
  const w = mount(Spielwelt, { props: { tasks, example: null, storage, ...extra }, attachTo: document.body })
  await run(10)
  return w
}
const viewX = (w: VueWrapper) => Number(w.find('[data-test="world"]').attributes('data-view-x'))
const pointer = (type: string, x: number, y: number) =>
  window.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }))
/** Screen pixels of a world point in the view */
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

describe('Spielwelt', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
    storage = memory()
    useSchoolStore().who = 2
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('takes a thing carried onto the object the task names', async () => {
    const w = await open([PLACE, FIND])
    expect(said()).toContain('Leg den Ball auf den Tisch.')
    await drag(w, 'ball', px(w, tisch.x, (tisch.top ?? 0) - 4))
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(said()).toContain('Super!')
    w.unmount()
  })

  it('says nothing when the thing is set down far from the object', async () => {
    const w = await open([PLACE])
    vi.mocked(speak).mockClear()
    await drag(w, 'ball', px(w, viewX(w) + 140, GROUND))
    expect(said()).toEqual([])
    w.unmount()
  })

  it('takes a tap on the thing to find', async () => {
    const w = await open([FIND, PLACE])
    await w.find('[data-test="thing-katze"]').trigger('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 })
    pointer('pointerup', 5, 5)
    await run(10)
    expect(said()).toContain('Super! Da ist die Katze!')
    w.unmount()
  })

  it('scrolls when she swipes the background, and wraps around the end', async () => {
    const w = await open([FIND])
    const before = viewX(w)
    await w.find('[data-test="world"]').trigger('pointerdown', { clientX: 600, clientY: 300, pointerId: 1 })
    pointer('pointermove', 400, 300)
    pointer('pointerup', 400, 300)
    await run(10)
    expect(viewX(w)).toBeCloseTo((before + 200 / PX_PER_UNIT) % WORLD_WIDTH)
    await w.find('[data-test="world"]').trigger('pointerdown', { clientX: 100, clientY: 300, pointerId: 1 })
    pointer('pointermove', 100 + (before + 200 / PX_PER_UNIT + 10) * PX_PER_UNIT, 300)
    pointer('pointerup', 0, 0)
    await run(10)
    expect(viewX(w)).toBeGreaterThan(WORLD_WIDTH - 20)
    w.unmount()
  })

  it('jumps to where she taps on the strip at the top', async () => {
    const w = await open([FIND])
    const strip = w.find('[data-test="strip"]')
    ;(strip.element as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 20 }) as DOMRect
    await strip.trigger('pointerdown', { clientX: 100, clientY: 5, pointerId: 1 })
    expect(Math.abs(viewX(w) + Number(w.find('[data-test="world"]').attributes('data-view-w')) / 2 - WORLD_WIDTH / 2)).toBeLessThan(2)
    w.unmount()
  })

  it('drives the car, and what is on it rides along', async () => {
    storage.setItem(KEY, JSON.stringify({ arrangement: { ball: { x: 0, y: 66, lane: 'mid', on: CAR } }, carX: 730 }))
    const w = await open([FIND])
    await w.find(`[data-test="object-${CAR}"]`).trigger('pointerdown', { clientX: 1, clientY: 1, pointerId: 1 })
    pointer('pointerup', 1, 1)
    await run(10)
    expect(playBeat).toHaveBeenCalledWith('bell')
    await w.find('[data-test="drive-right"]').trigger('pointerdown')
    await run(1000)
    await w.find('[data-test="drive-right"]').trigger('pointerup')
    const carX = Number(w.find(`[data-test="object-${CAR}"]`).attributes('data-x'))
    expect(carX).toBeGreaterThan(740)
    expect(Number(w.find('[data-test="thing-ball"]').attributes('data-x'))).toBe(carX)
    w.unmount()
  })

  it('keeps her arrangement for next time, and starts afresh from a broken one', async () => {
    const w = await open([FIND])
    await drag(w, 'teddy', px(w, viewX(w) + 30, GROUND))
    w.unmount()
    const kept = JSON.parse(storage.getItem(KEY) ?? '{}')
    expect(kept.arrangement.teddy.x).toBeCloseTo((viewX(w) + 30) % WORLD_WIDTH, 0)
    storage.setItem(KEY, '{"arrangement": {"ball": "nonsense"}}')
    const again = await open([FIND])
    expect(again.find('[data-test="thing-teddy"]').exists()).toBe(true)
    again.unmount()
  })

  it('records only solved tasks for the child who started, at the visit\'s step, and gives the Stars', async () => {
    const school = useSchoolStore()
    school.ladders = { ...school.ladders, raum: { step: 2, window: [] } }
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const w = await open([FIND, PLACE])
    await w.find('[data-test="thing-katze"]').trigger('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 })
    pointer('pointerup', 5, 5)
    await run(CHEER)
    school.who = 3
    requestLeave()
    await run(10)
    expect(w.emitted('finished')?.[0]).toEqual([{ stars: 1 }])
    expect(record).toHaveBeenCalledWith([{ ladder: 'raum', firstTry: true }], { raum: 2 }, 2)
  })

  it('stays open for free play after the tasks, and keeps the Stars when she leaves', async () => {
    const w = await open([FIND])
    await w.find('[data-test="thing-katze"]').trigger('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 })
    pointer('pointerup', 5, 5)
    await run(CHEER * 3)
    expect(said()).toContain('Super gemacht! Jetzt darfst du frei spielen.')
    expect(w.emitted('finished')).toBeUndefined()
    expect(w.find('[data-test="spielwelt"]').attributes('data-phase')).toBe('free')
    requestLeave()
    await run(10)
    expect(w.emitted('finished')?.[0]).toEqual([{ stars: 6 }])
  })

  it('shows the example first', async () => {
    const { exampleFor } = await import('@/core/raum')
    const w = mount(Spielwelt, { props: { tasks: [PLACE], example: exampleFor(1, 0), storage }, attachTo: document.body })
    expect(w.find('[data-test="example"]').exists()).toBe(true)
    await run(CHEER)
    expect(said()[0]).toBe('Schau: der Ball ist auf dem Tisch.')
    expect(said()).toContain('Leg den Ball auf den Tisch.')
    w.unmount()
  })
})

describe('placing on the table by dragging is judged like the flow', () => {
  it('uses the same place as the world module', () => {
    expect(placeFor({ word: 'auf', object: 'tisch' }).on).toBe('tisch')
  })
})
