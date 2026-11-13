import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { speak } from '@/services/tts'
import { MIN_MARKS, MIN_VISIT_MS } from '../effort'
import { requestLeave } from '../leave'
import Ausmalen from './Ausmalen.vue'
import { BLANK, COLORS, PAGES, loadPage } from './pages'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const tiles = (w: VueWrapper) => w.findAll('[data-test="page"]')
const regions = (w: VueWrapper) => w.findAll('[data-region]')

async function open(): Promise<VueWrapper> {
  const w = mount(Ausmalen, { attachTo: document.body })
  await flushPromises()
  return w
}

async function openPage(w: VueWrapper, id = 'lion') {
  await w.find(`[data-test="page"][data-id="${id}"]`).trigger('click')
  // The page's file is fetched first
  await vi.waitFor(() => expect(w.find('[data-test="sheet"]').exists()).toBe(true))
}

describe('the coloring pages', () => {
  it('has twenty pages, each with a picture and a name to say', () => {
    expect(PAGES).toHaveLength(20)
    expect(new Set(PAGES.map(p => p.id)).size).toBe(20)
    for (const p of PAGES) expect(p.icon && p.say).toBeTruthy()
  })

  it('loads every page as a picture with parts to fill and nothing that runs', async () => {
    for (const p of PAGES) {
      const svg = await loadPage(p.id)
      expect(svg, p.id).toMatch(/^<svg/)
      expect(svg, p.id).toContain('data-region')
      expect(svg, p.id).not.toMatch(/<script|\son\w+=|href=/i)
    }
  })

  it('offers the blank paper as a colour, to take a colour back', () => {
    expect(COLORS).toContain(BLANK)
  })
})

describe('Ausmalen', () => {
  beforeEach(() => vi.mocked(speak).mockClear())
  afterEach(() => { document.body.innerHTML = '' })

  it('starts at the wall of pages and says what to do', async () => {
    const w = await open()
    expect(tiles(w)).toHaveLength(20)
    expect(regions(w)).toHaveLength(0)
    expect(speak).toHaveBeenCalledWith(expect.stringContaining('Bild'))
    w.unmount()
  })

  it('opens a page with a tap and says its name', async () => {
    const w = await open()
    await openPage(w, 'lion')
    expect(tiles(w)).toHaveLength(0)
    expect(regions(w).length).toBeGreaterThan(5)
    expect(speak).toHaveBeenLastCalledWith('Der Löwe! Nimm eine Farbe und tipp auf das Bild.')
    w.unmount()
  })

  it('fills a tapped part with the chosen colour, and undo takes it back', async () => {
    const w = await open()
    await openPage(w)
    await w.findAll('[data-test="swatch"]')[2].trigger('click')
    const part = regions(w)[1]
    await part.trigger('click')
    expect(part.attributes('fill')).toBe(COLORS[2])
    await w.find('[data-test="undo"]').trigger('click')
    expect(part.attributes('fill')).toBe(BLANK)
    w.unmount()
  })

  it('leaves a page for the wall, and the wall for the town, with Esc or the leave button', async () => {
    const w = await open()
    await openPage(w)
    press('Escape')
    await flushPromises()
    expect(tiles(w)).toHaveLength(20)
    expect(w.emitted('finished')).toBeUndefined()

    await openPage(w, 'krone')
    requestLeave()
    await flushPromises()
    expect(tiles(w)).toHaveLength(20)
    requestLeave()
    // Nothing was coloured: not for the logbook
    expect(w.emitted('finished')).toEqual([[{ stars: 0, made: false }]])
    // Nothing more after leaving
    requestLeave()
    press('Escape')
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
  })

  it('counts the visit for the logbook after enough fills and time', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const w = await open()
    await openPage(w)
    for (let i = 0; i < MIN_MARKS; i++) await regions(w)[i % regions(w).length].trigger('click')
    now.mockReturnValue(1_000 + MIN_VISIT_MS)
    requestLeave()
    await flushPromises()
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0, made: true }]])
    w.unmount()
  })

  it('stops answering the leave button once gone', async () => {
    const w = await open()
    w.unmount()
    requestLeave()
    expect(w.emitted('finished')).toBeUndefined()
  })
})
