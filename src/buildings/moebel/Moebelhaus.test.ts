import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { pay } from '@/core/outfits'
import { speak } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useRoomStore } from '@/stores/room'
import { useWardrobeStore } from '@/stores/wardrobe'
import Moebelhaus from './Moebelhaus.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const item = (w: VueWrapper, id: string) => w.find(`[data-test="item"][data-id="${id}"]`)
const shelf = (w: VueWrapper, n: number) => w.find(`[data-test="shelf"][data-shelf="${n}"]`)
const spot = (w: VueWrapper, s: string) => w.find(`[data-test="spot"][data-spot="${s}"]`)
const lastSaid = () => vi.mocked(speak).mock.calls.at(-1)?.[0]

describe('the Möbelhaus', () => {
  let api: FakeApi
  async function open(stars = 100, savings = 0) {
    api = fakeApi({ stars, savings, visits: 2 })
    const player = usePlayerStore()
    player.init(api, 1)
    await player.refresh()
    const wardrobe = useWardrobeStore()
    wardrobe.init(api, 1)
    await wardrobe.load()
    const room = useRoomStore()
    room.init(api, 1)
    await room.load()
    const w = mount(Moebelhaus, { attachTo: document.body })
    await flushPromises()
    return { w, player, wardrobe, room }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(speak).mockClear()
  })

  it('shows three shelves of six, only the first open, with prices next to a Star', async () => {
    const { w } = await open()
    expect(shelf(w, 1).attributes('data-open')).toBe('true')
    expect(shelf(w, 2).attributes('data-open')).toBe('false')
    expect(shelf(w, 3).attributes('data-open')).toBe('false')
    expect(w.findAll('[data-test="item"]')).toHaveLength(18)
    expect(item(w, 'kaktus').text()).toContain('15')
    w.unmount()
  })

  it('says what to do when it opens', async () => {
    const { w } = await open()
    expect(speak).toHaveBeenCalledWith('Willkommen im Möbelhaus! Tipp auf etwas, dann siehst du es in deinem Zimmer.')
    w.unmount()
  })

  it('shows a piece she tries in the picture of her room, next to what stands there', async () => {
    const { w, room } = await open()
    api.room_.owned = [{ id: 'holzbett', got_at: '2026-11-12T10:00:00+01:00' }]
    api.room_.placed = { bett: 'holzbett' }
    await room.load()
    await item(w, 'kaktus').trigger('click')
    expect(lastSaid()).toBe('Kaktus. Fünfzehn Sterne.')
    expect(spot(w, 'pflanze').text()).toBe('🌵')
    expect(spot(w, 'bett').text()).toBe('🛏️')
    // Only tried: nothing is in her room yet
    expect(room.placed.pflanze).toBeUndefined()
    await item(w, 'kaktus').trigger('click')
    expect(spot(w, 'pflanze').attributes('data-empty')).toBe('true')
    w.unmount()
  })

  it('keeps the ✔️\'s place while nothing is tried, so the shelves don\'t jump under her finger', async () => {
    const { w } = await open()
    const slot = w.find('[data-test="buy-slot"]')
    expect(slot.exists()).toBe(true)
    expect(slot.find('[data-test="buy"]').exists()).toBe(false)
    await item(w, 'kaktus').trigger('click')
    expect(w.find('[data-test="buy-slot"] [data-test="buy"]').exists()).toBe(true)
    w.unmount()
  })

  it('says how many more open a locked shelf', async () => {
    const { w } = await open()
    await item(w, 'einhornbild').trigger('click')
    expect(lastSaid()).toBe('Kauf noch zwei Teile von oben, dann geht dieses Regal auf.')
    expect(w.find('[data-test="buy"]').exists()).toBe(false)
    w.unmount()
  })

  it('buys with the ✔️ and puts the piece in her room, then nothing more today', async () => {
    const { w, room, player } = await open()
    await item(w, 'pilzlampe').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Die Pilzlampe ist deine!')
    expect(room.placed.lampe).toBe('pilzlampe')
    expect(item(w, 'pilzlampe').attributes('data-owned')).toBe('true')
    expect(player.stars).toBe(75)
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await item(w, 'kaktus').trigger('click')
    const calls = api.calls.length
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.')
    expect(api.calls.length).toBe(calls)
    w.unmount()
  })

  it('after a purchase in the Kleiderladen, the Möbelhaus knows', async () => {
    const { w, wardrobe } = await open()
    expect(await wardrobe.buy('schal')).toBe('ok')
    await item(w, 'kaktus').trigger('click')
    expect(w.find('[data-test="buy"]').attributes('data-ready')).toBe('false')
    const calls = api.calls.length
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.')
    expect(api.calls.length).toBe(calls)
    w.unmount()
  })

  it('counts savings half: says how many Stars are missing', async () => {
    // All 40 are saved: they count as 20
    const { w } = await open(40, 40)
    await item(w, 'pilzlampe').trigger('click')
    expect(w.find('[data-test="buy"]').attributes('data-ready')).toBe('false')
    await w.find('[data-test="buy"]').trigger('click')
    expect(lastSaid()).toBe('Dafür brauchst du noch fünf Sterne.')
    expect(api.calls.some(c => c.startsWith('buyFurniture'))).toBe(false)
    w.unmount()
  })

  it('pays from the savings at two for one', async () => {
    const { w, player } = await open(40, 40)
    await item(w, 'kaktus').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect({ stars: player.stars, savings: player.savings }).toEqual(pay(15, 40, 40))
    expect(player.savings).toBeLessThan(40)
    w.unmount()
  })

  it('celebrates a new shelf', async () => {
    const { w, room } = await open()
    api.room_.owned = [{ id: 'kaktus', got_at: '2026-11-11T10:00:00+01:00' }]
    await room.load()
    await item(w, 'holzbett').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Das Holzbett ist deins! Ein neues Regal!')
    expect(shelf(w, 2).attributes('data-open')).toBe('true')
    w.unmount()
  })

  it('says why the server refused, and catches up with it', async () => {
    const { w } = await open()
    // Bought a moment ago on the laptop: this page doesn't know yet
    api.room_.owned = [{ id: 'kaktus', got_at: '2026-11-13T09:00:00+01:00' }]
    await item(w, 'kaktus').trigger('click')
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Das hast du schon.')
    expect(item(w, 'kaktus').attributes('data-owned')).toBe('true')
    w.unmount()
  })

  it('sends a purchase whose answer got lost again under the same key: it buys once', async () => {
    const { w, player } = await open()
    await item(w, 'kaktus').trigger('click')
    api.loseAnswers = true
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Das hat gerade nicht geklappt. Versuch es nochmal.')
    api.loseAnswers = false
    await w.find('[data-test="buy"]').trigger('click')
    await flushPromises()
    expect(lastSaid()).toBe('Der Kaktus ist deiner!')
    expect(player.stars).toBe(85)
    w.unmount()
  })
})
