import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import App from './App.vue'
import { createCity, type CityOptions } from './city/city'
import { unlockAudio } from './services/sound'
import { speak } from './services/tts'
import type { BuildingDef, BuildingResult } from './buildings/types'

vi.mock('./city/city', () => ({ createCity: vi.fn() }))
vi.mock('./services/sound', () => ({ unlockAudio: vi.fn(), playBeat: vi.fn() }))
vi.mock('./services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))
vi.mock('./services/device', () => ({ detectDevice: () => ({ camera: true, touch: false, keyboard: true }) }))

const city = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn() }
let cityOptions: CityOptions

// A building that finishes with whatever the test tells it to
let finishWith: (result: BuildingResult) => void
const StubBuilding = defineComponent({
  emits: ['finished'],
  setup(_, { emit }) {
    finishWith = result => emit('finished', result)
    return () => h('div', { 'data-test': 'stub-building' })
  },
})
const stub: BuildingDef = { id: 'stub', spokenName: 'Turnhalle', icon: '🤸', needs: [], door: { x: 2, z: 3 }, component: StubBuilding }
const camOnly: BuildingDef = { ...stub, id: 'touchy', spokenName: 'Schreiben', needs: ['touch'], door: { x: 8, z: 8 } }

const mountApp = (buildings: BuildingDef[] = []) =>
  mount(App, { props: { buildings }, global: { plugins: [createPinia()] } })

async function started(buildings: BuildingDef[] = [stub, camOnly]) {
  const w = mountApp(buildings)
  await w.find('[data-test="start-gate"]').trigger('pointerdown')
  await flushPromises()
  return w
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(unlockAudio).mockClear()
    vi.mocked(speak).mockClear()
    city.pause.mockClear()
    city.resume.mockClear()
    vi.mocked(createCity).mockReset().mockImplementation(async opts => {
      cityOptions = opts
      return city
    })
  })

  it('shows the start gate first and the game after a key press', async () => {
    const w = mountApp()
    expect(w.find('[data-test="start-gate"]').exists()).toBe(true)
    expect(w.find('[data-test="game"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await nextTick()
    expect(w.find('[data-test="start-gate"]').exists()).toBe(false)
    expect(w.find('[data-test="game"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows the star count in the game', async () => {
    const w = await started()
    expect(w.find('[data-test="stars"]').text()).toBe('0')
    w.unmount()
  })

  it('unlocks sound when the game starts', async () => {
    const w = mountApp()
    expect(unlockAudio).not.toHaveBeenCalled()
    await w.find('[data-test="start-gate"]').trigger('pointerdown')
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('gives the town one door per building, closed when the device cannot serve it', async () => {
    const w = await started()
    expect(cityOptions.doors).toEqual([
      { id: 'stub', x: 2, z: 3, open: true, icon: '🤸' },
      { id: 'touchy', x: 8, z: 8, open: false, icon: '🤸' },
    ])
    w.unmount()
  })

  it('speaks the name and shows the prompt near a door', async () => {
    const w = await started()
    expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
    cityOptions.onNearDoor('stub')
    await nextTick()
    expect(speak).toHaveBeenCalledWith('Turnhalle')
    const prompt = w.find('[data-test="door-prompt"]')
    expect(prompt.exists()).toBe(true)
    expect(prompt.attributes('data-open')).toBe('true')
    cityOptions.onNearDoor(null)
    await nextTick()
    expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
    expect(speak).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('shows a closed door as closed', async () => {
    const w = await started()
    cityOptions.onNearDoor('touchy')
    await nextTick()
    expect(w.find('[data-test="door-prompt"]').attributes('data-open')).toBe('false')
    w.unmount()
  })

  it('opens the building on enter and pauses the town', async () => {
    const w = await started()
    cityOptions.onNearDoor('stub')
    cityOptions.onEnter('stub')
    await nextTick()
    expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
    expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
    expect(city.pause).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('awards the stars and returns to the town when the building finishes', async () => {
    const w = await started()
    cityOptions.onEnter('stub')
    await nextTick()
    finishWith({ stars: 9 })
    await nextTick()
    expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
    expect(w.find('[data-test="stars"]').text()).toBe('9')
    expect(city.resume).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('awards nothing for { stars: 0 }', async () => {
    const w = await started()
    cityOptions.onEnter('stub')
    await nextTick()
    finishWith({ stars: 0 })
    await nextTick()
    expect(w.find('[data-test="stars"]').text()).toBe('0')
    expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
    w.unmount()
  })

  it('ignores enter for an unknown door', async () => {
    const w = await started()
    cityOptions.onEnter('nowhere')
    await nextTick()
    expect(city.pause).not.toHaveBeenCalled()
    w.unmount()
  })
})
