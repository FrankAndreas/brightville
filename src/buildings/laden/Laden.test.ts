import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { speak } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useWardrobeStore } from '@/stores/wardrobe'
import Laden from './Laden.vue'

vi.mock('@/city/preview', () => ({ createPreview: () => ({ setDress: vi.fn(), dispose: vi.fn() }) }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const item = (w: VueWrapper, id: string) => w.find(`[data-test="item"][data-id="${id}"]`)
const shelf = (w: VueWrapper, n: number) => w.find(`[data-test="shelf"][data-shelf="${n}"]`)
const lastSaid = () => vi.mocked(speak).mock.calls.at(-1)?.[0]

describe('the Kleiderladen', () => {
  let api: FakeApi
  async function open(stars = 100, savings = 0) {
    api = fakeApi({ stars, savings, visits: 2 })
    const player = usePlayerStore()
    player.init(api, 1)
    await player.refresh()
    const wardrobe = useWardrobeStore()
    wardrobe.init(api, 1)
    await wardrobe.load()
    const w = mount(Laden, { attachTo: document.body })
    await flushPromises()
    return { w, player, wardrobe }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(speak).mockClear()
  })

  it('shows three shelves, only the first open, with prices next to a Star', async () => {
    const { w } = await open()
    expect(shelf(w, 1).attributes('data-open')).toBe('true')
    expect(shelf(w, 2).attributes('data-open')).toBe('false')
    expect(shelf(w, 3).attributes('data-open')).toBe('false')
    expect(item(w, 'schal').text()).toContain('20')
    expect(w.findAll('[data-test="item"]')).toHaveLength(15)
    w.unmount()
  })

  it('tries an add-on on and says its name and price', async () => {
    const { w, wardrobe } = await open()
    await item(w, 'schal').trigger('click')
    expect(lastSaid()).toBe('Schal. Zwanzig Sterne.')
    expect(w.find('[data-test="buy"]').text()).toContain('20')
    // Only tried on: nothing is bought or worn yet
    expect(wardrobe.worn).toEqual({})
    w.unmount()
  })

  it('says how many more open a locked shelf', async () => {
    const { w } = await open()
    await item(w, 'krone').trigger('click')
    expect(lastSaid()).toBe('Kauf noch zwei Teile von oben, dann geht dieses Regal auf.')
    expect(w.find('[data-test="buy"]').exists()).toBe(false)
    w.unmount()
  })

  it('buys with the ✔️, then nothing more today', async () => {
    const { w } = await open()
    await item(w, 'schal').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Der Schal ist deiner!')
    expect(item(w, 'schal').attributes('data-owned')).toBe('true')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await item(w, 'kappe').trigger('click')
    const calls = api.calls.length
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.')
    expect(api.calls.length).toBe(calls)
    w.unmount()
  })

  it('pays from the savings at two for one: the Star counter drops by 40 for the Kappe', async () => {
    const { w, player } = await open(70, 60)
    await item(w, 'kappe').trigger('click')
    expect(w.find('[data-test="buy"]').attributes('data-ready')).toBe('true')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(player.stars).toBe(30)
    w.unmount()
  })

  it('says how many Stars are missing, counting savings half', async () => {
    const { w } = await open(30, 30)
    await item(w, 'schal').trigger('click')
    expect(w.find('[data-test="buy"]').attributes('data-ready')).toBe('false')
    await w.find('[data-test="buy"]').trigger('click')
    expect(lastSaid()).toBe('Dafür brauchst du noch fünf Sterne.')
    expect(api.calls.some(c => c.startsWith('buy'))).toBe(false)
    w.unmount()
  })

  it('celebrates a new shelf', async () => {
    const { w, wardrobe } = await open()
    api.wardrobe_.owned = [{ id: 'schleife', how: 'bought', got_at: '2026-11-11T10:00:00+01:00' }]
    await wardrobe.load()
    await item(w, 'kappe').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Die Kappe ist deine! Ein neues Regal!')
    expect(shelf(w, 2).attributes('data-open')).toBe('true')
    w.unmount()
  })

  it('says what to do when it opens', async () => {
    const { w } = await open()
    expect(speak).toHaveBeenCalledWith('Willkommen im Kleiderladen! Tipp auf etwas, dann probierst du es an.')
    w.unmount()
  })
})
