import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { GLYPHS, type Point } from '@/core/writing/letters'
import type { WritingTask } from '@/core/writing/session'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Schreiben from './Schreiben.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

// Without a layout the board maps a pixel to a letter unit, so points can be sent as they are
const TASKS: WritingTask[] = [{ glyph: 'I', help: 'full' }, { glyph: 'L', help: 'start' }]
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
/** Long enough for the cheer and the pause before the next letter */
const CHEER = 1000

async function open(tasks = TASKS): Promise<VueWrapper> {
  const w = mount(Schreiben, { props: { tasks }, attachTo: document.body })
  await run(10)
  return w
}
const board = (w: VueWrapper) => w.find('[data-test="board"]').element
const send = (w: VueWrapper, type: string, pointerId: number, p: Point, size = 10) =>
  board(w).dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX: p.x, clientY: p.y, width: size, height: size }))

/** Writes every stroke of the glyph, lifting the pen between strokes. */
function write(w: VueWrapper, glyph: string, id = 1) {
  for (const stroke of GLYPHS[glyph].strokes) {
    send(w, 'pointerdown', id, stroke[0])
    for (const p of stroke) send(w, 'pointermove', id, p)
    send(w, 'pointerup', id, stroke[stroke.length - 1])
  }
}
const stars = (w: VueWrapper) => w.findAll('[data-test="progress-star"][data-done="true"]').length
const phase = (w: VueWrapper) => w.find('[data-test="schreiben"]').attributes('data-phase')

describe('Schreiben', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('asks for the first letter and shows a star to earn per letter', async () => {
    const w = await open()
    expect(said()).toEqual(['Schreib ein I! Fang beim grünen Punkt an.'])
    expect(w.findAll('[data-test="progress-star"]')).toHaveLength(2)
    expect(stars(w)).toBe(0)
    expect(w.find('[data-test="schreiben"]').attributes('data-glyph')).toBe('I')
    w.unmount()
  })

  it('gives a star, a chime and a cheer for a written letter, then asks for the next', async () => {
    const w = await open()
    write(w, 'I')
    await run(10)
    expect(stars(w)).toBe(1)
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(said().at(-1)).toBe('Super! Ein I!')
    expect(phase(w)).toBe('cheering')
    await run(CHEER)
    expect(phase(w)).toBe('writing')
    expect(said().at(-1)).toBe('Jetzt ein El.')
    w.unmount()
  })

  it('says "nochmal" when the same letter comes again', async () => {
    const w = await open([{ glyph: 'I', help: 'full' }, { glyph: 'I', help: 'dots' }])
    write(w, 'I')
    await run(CHEER)
    expect(said().at(-1)).toBe('Und nochmal ein I.')
    w.unmount()
  })

  it('takes no writing during the cheer', async () => {
    const w = await open()
    write(w, 'I')
    write(w, 'L')
    await run(10)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('starts the stroke over when the pen lifts early, with a kind word only after a real try', async () => {
    const w = await open()
    const stroke = GLYPHS.I.strokes[0]
    send(w, 'pointerdown', 1, stroke[0])
    send(w, 'pointerup', 1, stroke[0])
    expect(said()).toHaveLength(1)
    send(w, 'pointerdown', 1, stroke[0])
    for (const p of stroke.slice(0, 20)) send(w, 'pointermove', 1, p)
    send(w, 'pointerup', 1, stroke[19])
    expect(said().at(-1)).toBe('Fast! Fang nochmal beim grünen Punkt an.')
    expect(stars(w)).toBe(0)
    write(w, 'I')
    await run(10)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('points to the green dot when the pen starts at the wrong end, but not over and over', async () => {
    const w = await open()
    const stroke = GLYPHS.I.strokes[0]
    send(w, 'pointerdown', 1, stroke[stroke.length - 1])
    send(w, 'pointerup', 1, stroke[stroke.length - 1])
    expect(said().at(-1)).toBe('Andersherum! Fang beim grünen Punkt an.')
    send(w, 'pointerdown', 1, stroke[stroke.length - 1])
    send(w, 'pointerup', 1, stroke[stroke.length - 1])
    expect(said()).toHaveLength(2)
    await run(4100)
    send(w, 'pointerdown', 1, stroke[stroke.length - 1])
    expect(said()).toHaveLength(3)
    w.unmount()
  })

  it('says nothing for a touch beside the letter or a resting hand', async () => {
    const w = await open()
    const stroke = GLYPHS.I.strokes[0]
    send(w, 'pointerdown', 1, stroke[0])
    send(w, 'pointerdown', 2, { x: 119, y: 5 }, 10)
    send(w, 'pointerdown', 3, stroke[stroke.length - 1], 80)
    for (const p of stroke) send(w, 'pointermove', 1, p)
    await run(10)
    expect(said()).toHaveLength(2)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('finishes with confetti, the bonus and one more star per letter', async () => {
    const w = await open()
    write(w, 'I')
    await run(CHEER)
    write(w, 'L')
    await run(CHEER)
    expect(phase(w)).toBe('done')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    expect(said().at(-1)).toBe('Super geschrieben!')
    expect(w.emitted('finished')).toBeUndefined()
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 6 }]])
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it.each([
    ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))],
    ['the leave button', () => requestLeave()],
  ])('leaves on %s with the stars so far, once, and stops its timers', async (_, go) => {
    const w = await open()
    write(w, 'I')
    await run(10)
    go()
    go()
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('keeps the bonus when leaving during the last cheer', async () => {
    const w = await open()
    write(w, 'I')
    await run(CHEER)
    write(w, 'L')
    await run(10)
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 6 }]])
    w.unmount()
  })

  it('goes straight back when there is nothing to write', async () => {
    const w = await open([])
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('shows no words', async () => {
    const w = await open()
    expect(w.text().trim()).toBe('')
    w.unmount()
  })
})
