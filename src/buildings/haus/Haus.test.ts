import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { LogDay } from '@/core/diary'
import { STICKERS } from '@/core/stickers'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useWardrobeStore } from '@/stores/wardrobe'
import { requestLeave } from '../leave'
import Haus from './Haus.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})
vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), playNote: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/city/preview', () => ({ createPreview: () => ({ setDress: vi.fn(), dispose: vi.fn() }) }))

const day = (d: string, more: Partial<LogDay> = {}): LogDay => ({
  day: d, goal_reached: false, stickers: [], paintings: [],
  entries: [{ building: 'school', kind: 'visit', stars: 7, at: '15:00' }], ...more,
})
const row = (id: string, seen = true) => ({ id, earned_at: '2026-11-12T10:00:00+01:00', seen })

let api: FakeApi

async function open(): Promise<VueWrapper> {
  const player = usePlayerStore()
  player.init(api, 1)
  await player.refresh()
  const wardrobe = useWardrobeStore()
  wardrobe.init(api, 1)
  await wardrobe.load()
  const w = mount(Haus, { props: { api }, attachTo: document.body })
  await flushPromises()
  return w
}

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const lastSaid = () => vi.mocked(speak).mock.calls.at(-1)?.[0]

describe('Haus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    vi.mocked(speak).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('opens on a room with the logbook and the sticker book, and leaves with no Stars', async () => {
    const w = await open()
    expect(w.find('[data-test="open-book"]').exists()).toBe(true)
    expect(w.find('[data-test="open-album"]').attributes('data-new')).toBe('false')
    press('Escape')
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
  })

  describe('the wardrobe', () => {
    const kappe = { id: 'kappe', how: 'bought' as const, got_at: '2026-11-12T10:00:00+01:00' }

    it('opens from the third thing in the room', async () => {
      const w = await open()
      await w.find('[data-test="open-wardrobe"]').trigger('click')
      expect(w.find('[data-test="kleiderschrank"]').exists()).toBe(true)
      expect(w.find('[data-test="character"]').exists()).toBe(true)
    })

    it('puts an add-on on with a tap, and takes it off with another', async () => {
      api.wardrobe_.owned = [kappe]
      const w = await open()
      await w.find('[data-test="open-wardrobe"]').trigger('click')
      await w.find('[data-test="wear"][data-id="kappe"]').trigger('click')
      await flushPromises()
      expect(api.calls).toContain('setWorn {"head":"kappe"}')
      expect(w.find('[data-test="wear"][data-id="kappe"]').attributes('data-worn')).toBe('true')
      await w.find('[data-test="wear"][data-id="kappe"]').trigger('click')
      await flushPromises()
      expect(api.calls).toContain('setWorn {"head":null}')
      expect(api.wardrobe_.worn).toEqual({})
    })

    it('points to the Kleiderladen while it is empty', async () => {
      const w = await open()
      await w.find('[data-test="open-wardrobe"]').trigger('click')
      expect(w.find('[data-test="wear"]').exists()).toBe(false)
      expect(lastSaid()).toBe('Im Kleiderladen kannst du dir etwas aussuchen.')
    })

    it('changes her look with ✏️, and keeps it with ✔️', async () => {
      const w = await open()
      await w.find('[data-test="open-wardrobe"]').trigger('click')
      await w.find('[data-test="edit-look"]').trigger('click')
      await w.findAll('[data-test="look-body"]')[1].trigger('click')
      await w.find('[data-test="look-done"]').trigger('click')
      await flushPromises()
      expect(api.wardrobe_.look).toMatchObject({ body: '#4f8fe8' })
      expect(w.find('[data-test="look-screen"]').exists()).toBe(false)
      expect(w.find('[data-test="kleiderschrank"]').exists()).toBe(true)
    })
  })

  it('makes the sticker book glow while there is a sticker not seen yet', async () => {
    api.stickers_ = [row('buecherwurm', false)]
    const w = await open()
    expect(w.find('[data-test="open-album"]').attributes('data-new')).toBe('true')
  })

  describe('the logbook', () => {
    it('shows the newest day first and says its date', async () => {
      api.logbook_ = [day('2026-11-12', { goal_reached: true }), day('2026-11-10')]
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="page"]').attributes('data-day')).toBe('2026-11-12')
      expect(w.find('[data-test="sun"]').exists()).toBe(true)
      expect(lastSaid()).toBe('Donnerstag, zwölfter November')
      expect(w.findAll('[data-test="entry"]').map(e => e.text())).toEqual(['🔢+7'])
    })

    it('says an entry when it is tapped', async () => {
      api.logbook_ = [day('2026-11-12', {
        entries: [
          { building: 'school', kind: 'visit', stars: 7, at: '15:00' },
          { building: 'arcade', kind: 'play', stars: -3, at: '16:00' },
        ],
      })]
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      const entries = w.findAll('[data-test="entry"]')
      await entries[0].trigger('click')
      expect(lastSaid()).toBe('Schule, sieben Sterne.')
      await entries[1].trigger('click')
      expect(lastSaid()).toBe('Spielhalle, drei Sterne ausgegeben.')
    })

    it('shows the stickers and paintings of a day', async () => {
      api.logbook_ = [day('2026-11-12', { stickers: ['buecherwurm'], paintings: [{ id: 'p-1', updated: 5 }] })]
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      await w.find('[data-test="day-sticker"]').trigger('click')
      expect(lastSaid()).toBe('Bücherwurm.')
      expect(w.find('[data-test="day-painting"]').attributes('src')).toBe('/api/paintings/p-1/thumb?v=5')
    })

    it('flips to older days, asks the server for more at the end, and stops when there are none', async () => {
      api.logbook_ = Array.from({ length: 9 }, (_, i) => day(`2026-11-${String(20 - i).padStart(2, '0')}`))
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      const older = () => w.find('[data-test="older"]')
      for (let i = 0; i < 7; i++) {
        await older().trigger('click')
        await flushPromises()
      }
      expect(api.calls).toContain('logbook 2026-11-14 7')
      expect(w.find('[data-test="page"]').attributes('data-day')).toBe('2026-11-13')
      await older().trigger('click')
      await flushPromises()
      expect(w.find('[data-test="page"]').attributes('data-day')).toBe('2026-11-12')
      expect(older().attributes('disabled')).toBeDefined()
      await w.find('[data-test="newer"]').trigger('click')
      expect(w.find('[data-test="page"]').attributes('data-day')).toBe('2026-11-13')
    })

    it('says when the logbook is still empty', async () => {
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="empty"]').exists()).toBe(true)
      expect(lastSaid()).toBe('Dein Tagebuch ist noch leer.')
    })

    it('goes back to the room', async () => {
      const w = await open()
      await w.find('[data-test="open-book"]').trigger('click')
      await flushPromises()
      await w.find('[data-test="back"]').trigger('click')
      expect(w.find('[data-test="open-book"]').exists()).toBe(true)
    })
  })

  describe('the sticker book', () => {
    it('shows every sticker, earned ones in colour, nine to a page', async () => {
      api.stickers_ = [row('buecherwurm'), row('springfloh')]
      const w = await open()
      await w.find('[data-test="open-album"]').trigger('click')
      await flushPromises()
      const page1 = w.findAll('[data-test="sticker"]')
      expect(page1).toHaveLength(9)
      expect(w.find('[data-test="prev"]').attributes('disabled')).toBeDefined()
      await w.find('[data-test="next"]').trigger('click')
      const page2 = w.findAll('[data-test="sticker"]')
      expect(page2).toHaveLength(STICKERS.length - 9)
      const earned = [...page1, ...page2].filter(s => s.attributes('data-earned') === 'true').map(s => s.attributes('data-id'))
      expect(earned).toEqual(['buecherwurm', 'springfloh'])
    })

    it('says what a sticker is for, with its name once earned', async () => {
      api.stickers_ = [row('rechenprofi')]
      const w = await open()
      await w.find('[data-test="open-album"]').trigger('click')
      await flushPromises()
      await w.find('[data-test="sticker"][data-id="rechenprofi"]').trigger('click')
      expect(lastSaid()).toBe('Rechenprofi. Für zehn Besuche in der Schule.')
      await w.find('[data-test="sticker"][data-id="schreibprofi"]').trigger('click')
      expect(lastSaid()).toBe('Für zehn Besuche beim Schreiben.')
    })

    it('marks new stickers and counts them seen once the book was open a moment', async () => {
      vi.useFakeTimers()
      api.stickers_ = [row('rechenprofi', false)]
      const w = await open()
      await w.find('[data-test="open-album"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="sticker"][data-id="rechenprofi"]').attributes('data-new')).toBe('true')
      await vi.advanceTimersByTimeAsync(2000)
      expect(api.calls).toContain('stickersSeen rechenprofi')
      w.unmount()
    })
  })

  it('leaves from the logbook with the leave button', async () => {
    const w = await open()
    await w.find('[data-test="open-book"]').trigger('click')
    await flushPromises()
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
  })
})
