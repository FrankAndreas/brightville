import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useWritingStore } from '@/stores/writing'
import { GLYPHS, type Point } from '@/core/writing/letters'
import type { WritingTask } from '@/core/writing/session'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Schreiben from './Schreiben.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

// Without a layout the board maps a pixel to a letter unit, so points can be sent as they are
const TASKS: WritingTask[] = [{ glyph: 'I', help: 'full' }, { glyph: 'L', help: 'start' }]
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
/** Long enough for the cheer and the pause before the next letter */
const CHEER = 1000

let pinia: Pinia
let api: FakeApi
async function open(tasks = TASKS): Promise<VueWrapper> {
  const w = mount(Schreiben, { props: { tasks }, attachTo: document.body, global: { plugins: [pinia] } })
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
function memory(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size },
  }
}
const stars = (w: VueWrapper) => w.findAll('[data-test="progress-star"][data-done="true"]').length
const phase = (w: VueWrapper) => w.find('[data-test="schreiben"]').attributes('data-phase')

describe('Schreiben', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    api = fakeApi()
    useWritingStore().init(api, 1, memory())
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
    await run(10)
    // the next letter's first stroke, written before it is shown
    const stroke = GLYPHS.L.strokes[0]
    send(w, 'pointerdown', 5, stroke[0])
    for (const p of stroke) send(w, 'pointermove', 5, p)
    send(w, 'pointerup', 5, stroke[stroke.length - 1])
    await run(CHEER)
    expect(phase(w)).toBe('writing')
    expect(stars(w)).toBe(1)
    // and a pen still down from then is not the pen now
    for (const p of stroke) send(w, 'pointermove', 5, p)
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

  it('says nothing for a touch beside the letter', async () => {
    const w = await open()
    send(w, 'pointerdown', 2, { x: 119, y: 5 })
    send(w, 'pointerup', 2, { x: 119, y: 5 })
    expect(said()).toHaveLength(1)
    w.unmount()
  })

  it('does not take a resting hand for the pen, even on the start dot', async () => {
    const w = await open()
    const stroke = GLYPHS.I.strokes[0]
    // the pen shows its size first
    send(w, 'pointerdown', 1, stroke[0])
    send(w, 'pointerup', 1, stroke[0])
    send(w, 'pointerdown', 3, stroke[0], 80)
    for (const p of stroke) send(w, 'pointermove', 3, p)
    await run(10)
    expect(stars(w)).toBe(0)
    expect(said()).toHaveLength(1)
    send(w, 'pointerup', 3, stroke[0])
    write(w, 'I')
    await run(10)
    expect(stars(w)).toBe(1)
    w.unmount()
  })

  it('leaves no timer behind when the child leaves while the cheer is still spoken', async () => {
    let endCheer = () => {}
    vi.mocked(speak).mockImplementationOnce(() => Promise.resolve())
    const w = await open()
    vi.mocked(speak).mockImplementationOnce(() => new Promise<void>(resolve => { endCheer = resolve }))
    write(w, 'I')
    await run(10)
    requestLeave()
    endCheer()
    await run(0)
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('gives nothing to write, and so no bonus, when the visit names a glyph it does not know', async () => {
    const w = await open([{ glyph: 'I', help: 'full' }, { glyph: 'ß', help: 'full' }])
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
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

  describe('clean or bumpy', () => {
    const met = (level: 1 | 2 | 3 | 4) => ({ level, streak: 0, practised_at: null })
    const help = (w: VueWrapper) => w.find('[data-test="schreiben"]').attributes('data-help')
    /** The letters she has met, on the server and in the store */
    async function meet(letters: Record<string, ReturnType<typeof met>>) {
      api.writing_.letters = letters
      const writing = useWritingStore()
      await writing.load()
      return writing
    }

    it('counts a clean write of a letter she has met', async () => {
      const writing = await meet({ I: met(1) })
      const w = await open([{ glyph: 'I', help: 'full', counts: true }, { glyph: 'L', help: 'full' }])
      write(w, 'I')
      await run(10)
      expect(writing.letters.I).toMatchObject({ level: 1, streak: 1 })
      w.unmount()
    })

    it('counts a write as bumpy after a start at the wrong end', async () => {
      const writing = await meet({ I: met(1) })
      const w = await open([{ glyph: 'I', help: 'full', counts: true }, { glyph: 'L', help: 'full' }])
      const stroke = GLYPHS.I.strokes[0]
      send(w, 'pointerdown', 1, stroke[stroke.length - 1])
      send(w, 'pointerup', 1, stroke[stroke.length - 1])
      write(w, 'I')
      await run(10)
      expect(writing.letters.I).toMatchObject({ level: 1, streak: -1 })
      w.unmount()
    })

    it('counts a write as bumpy after lifting early in a real try, not after a tap', async () => {
      const writing = await meet({ I: met(1), L: met(1) })
      const w = await open([{ glyph: 'I', help: 'full', counts: true }, { glyph: 'L', help: 'full', counts: true }])
      const stroke = GLYPHS.I.strokes[0]
      send(w, 'pointerdown', 1, stroke[0])
      send(w, 'pointerup', 1, stroke[0])
      write(w, 'I')
      await run(CHEER)
      expect(writing.letters.I.streak).toBe(1)
      const l = GLYPHS.L.strokes[0]
      send(w, 'pointerdown', 1, l[0])
      for (const p of l.slice(0, 20)) send(w, 'pointermove', 1, p)
      send(w, 'pointerup', 1, l[19])
      write(w, 'L')
      await run(10)
      expect(writing.letters.L.streak).toBe(-1)
      w.unmount()
    })

    it('takes a touch beside the letter as nothing, while help is shown', async () => {
      const writing = await meet({ I: met(1) })
      const w = await open([{ glyph: 'I', help: 'full', counts: true }, { glyph: 'L', help: 'full' }])
      send(w, 'pointerdown', 2, { x: 119, y: 5 })
      send(w, 'pointerup', 2, { x: 119, y: 5 })
      write(w, 'I')
      await run(10)
      expect(writing.letters.I.streak).toBe(1)
      w.unmount()
    })

    it('records nothing for a letter she has not met', async () => {
      const writing = useWritingStore()
      const w = await open([{ glyph: 'I', help: 'full', counts: false }, { glyph: 'L', help: 'full' }])
      write(w, 'I')
      await run(10)
      expect(writing.letters).toEqual({})
      w.unmount()
    })

    it('shows the help her level gives now', async () => {
      await meet({ I: met(3) })
      const w = await open([{ glyph: 'I', help: 'full', counts: true }, { glyph: 'L', help: 'full' }])
      expect(help(w)).toBe('start')
      w.unmount()
    })

    it('shows the start dot of a known letter after a touch on the letter away from it', async () => {
      await meet({ I: met(4) })
      const w = await open([{ glyph: 'I', help: 'none', counts: true }, { glyph: 'L', help: 'full' }])
      const stroke = GLYPHS.I.strokes[0]
      send(w, 'pointerdown', 1, stroke[stroke.length - 1])
      send(w, 'pointerup', 1, stroke[stroke.length - 1])
      await run(10)
      expect(help(w)).toBe('start')
      w.unmount()
    })

    it('shows nothing of a known letter, and the start dot after a miss, which makes it bumpy', async () => {
      const writing = await meet({ I: met(4) })
      const w = await open([{ glyph: 'I', help: 'none', counts: true }, { glyph: 'L', help: 'full' }])
      expect(help(w)).toBe('none')
      send(w, 'pointerdown', 2, { x: 119, y: 5 })
      send(w, 'pointerup', 2, { x: 119, y: 5 })
      await run(10)
      expect(help(w)).toBe('start')
      expect(said().at(-1)).toBe('Fang beim grünen Punkt an.')
      write(w, 'I')
      await run(10)
      expect(writing.letters.I.streak).toBe(-1)
      w.unmount()
    })
  })

  describe('her words and today\'s letters', () => {
    /** Opens Schreiben as the town does: no tasks given, the store asks the server */
    async function enter(): Promise<VueWrapper> {
      const w = mount(Schreiben, { attachTo: document.body, global: { plugins: [pinia] } })
      await run(10)
      return w
    }
    const cards = (w: VueWrapper) => w.findAll('[data-test="text-card"]').map(c => c.text())
    const glyph = (w: VueWrapper) => w.find('[data-test="schreiben"]').attributes('data-glyph')
    const slots = (w: VueWrapper) => w.findAll('[data-test="ink-slot"]')
    async function writeAll(w: VueWrapper, text: string) {
      for (const c of text.replace(/ /g, '')) {
        expect(glyph(w)).toBe(c)
        write(w, c)
        await run(CHEER)
      }
    }

    it('offers her words and a die', async () => {
      api.writing_.texts = ['MIA', 'LENA']
      const w = await enter()
      expect(cards(w)).toEqual(['MIA', 'LENA'])
      expect(w.find('[data-test="dice-card"]').exists()).toBe(true)
      expect(said().at(-1)).toBe('Was möchtest du schreiben? Tipp auf eine Karte.')
      w.unmount()
    })

    it('writes a word letter by letter, with her ink in the row, for a Star a letter and the bonus', async () => {
      api.writing_.texts = ['MIA']
      const w = await enter()
      await w.find('[data-test="text-card"]').trigger('click')
      await run(10)
      expect(said()).toContain('Wir schreiben: Mia! Zuerst ein Em.')
      expect(slots(w)).toHaveLength(3)
      await writeAll(w, 'MIA')
      expect(slots(w).filter(s => s.attributes('data-done') === 'true')).toHaveLength(3)
      expect(phase(w)).toBe('done')
      expect(said()).toContain('Super geschrieben! Mia!')
      await run(3100)
      expect(w.emitted('finished')).toEqual([[{ stars: 7 }]])
      w.unmount()
    })

    it('leaves a gap between words and names the next word', async () => {
      api.writing_.texts = ['MIA BEN']
      const w = await enter()
      await w.find('[data-test="text-card"]').trigger('click')
      await run(10)
      expect(w.findAll('[data-test="ink-gap"]')).toHaveLength(1)
      await writeAll(w, 'MIA')
      expect(said()).toContain('Jetzt das Wort Ben. Zuerst ein Be.')
      w.unmount()
    })

    it('shows each letter of a word with the help her level gives', async () => {
      api.writing_.texts = ['MI']
      api.writing_.letters = { M: { level: 2, streak: 0, practised_at: null } }
      const w = await enter()
      await w.find('[data-test="text-card"]').trigger('click')
      await run(10)
      expect(w.find('[data-test="schreiben"]').attributes('data-help')).toBe('dots')
      write(w, 'M')
      await run(CHEER)
      expect(w.find('[data-test="schreiben"]').attributes('data-help')).toBe('full')
      expect(useWritingStore().letters.M.streak).toBe(1)
      w.unmount()
    })

    it('introduces two new letters on the die, each after its third write', async () => {
      api.writing_.texts = ['LENA']
      const w = await enter()
      await w.find('[data-test="dice-card"]').trigger('click')
      await run(10)
      await writeAll(w, 'LLL')
      expect(Object.keys(api.writing_.letters)).toEqual(['L'])
      await writeAll(w, 'EEE')
      expect(Object.keys(api.writing_.letters).sort()).toEqual(['E', 'L'])
      expect(useWritingStore().newLeft).toBe(0)
      w.unmount()
    })

    it('keeps both new letters on a day after two were met', async () => {
      api.writing_.texts = ['LENA']
      api.writing_.letters = { L: { level: 1, streak: 0, practised_at: null }, E: { level: 1, streak: 0, practised_at: null } }
      api.writing_.introducedOn = { L: '2026-11-11', E: '2026-11-11' }
      const w = await enter()
      await w.find('[data-test="dice-card"]').trigger('click')
      await run(10)
      await writeAll(w, 'NNNAAA')
      expect(Object.keys(api.writing_.letters).sort()).toEqual(['A', 'E', 'L', 'N'])
      expect(useWritingStore().letters.A?.level).toBe(1)
      w.unmount()
    })

    it('introduces nothing when she leaves before the third write', async () => {
      api.writing_.texts = ['LENA']
      const w = await enter()
      await w.find('[data-test="dice-card"]').trigger('click')
      await run(10)
      await writeAll(w, 'LL')
      requestLeave()
      await run(10)
      expect(api.writing_.letters).toEqual({})
      expect(useWritingStore().letters).toEqual({})
      expect(w.emitted('finished')).toEqual([[{ stars: 2 }]])
      w.unmount()
    })

    it('starts today\'s letters at once when she has no words', async () => {
      const w = await enter()
      expect(w.find('[data-test="text-card"]').exists()).toBe(false)
      expect(w.find('[data-test="dice-card"]').exists()).toBe(false)
      expect(glyph(w)).toMatch(/^[A-ZÄÖÜ]$/)
      expect(said().at(-1)).toMatch(/^Schreib ein/)
      w.unmount()
    })

    it('goes on without the server after a while', async () => {
      api.writing = () => new Promise(() => {})
      const w = await enter()
      expect(glyph(w)).toBe('')
      await run(5100)
      expect(glyph(w)).toMatch(/^[A-ZÄÖÜ]$/)
      w.unmount()
    })
  })
})
