import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import App from './App.vue'
import { createCity, type CityOptions } from './city/city'
import { unlockAudio } from './services/sound'
import { speak } from './services/tts'
import type { BuildingDef, BuildingResult } from './buildings/types'
import { usePlayerStore } from './stores/player'

vi.mock('./city/city', () => ({ createCity: vi.fn() }))
vi.mock('./services/sound', () => ({ unlockAudio: vi.fn(), playBeat: vi.fn() }))
vi.mock('./services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))
const device = vi.hoisted(() => ({ camera: true, touch: false, keyboard: true }))
vi.mock('./services/device', () => ({ detectDevice: () => ({ ...device }) }))

const city = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(), setDoors: vi.fn() }
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
const stub: BuildingDef = { id: 'stub', spokenName: 'Turnhalle', icon: '🤸', kind: 'earn', needs: [], door: { x: 2, z: 3 }, component: StubBuilding }
const camOnly: BuildingDef = { ...stub, id: 'touchy', spokenName: 'Schreiben', needs: ['touch'], door: { x: 8, z: 8 } }
const play: BuildingDef = { ...stub, id: 'play', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, door: { x: -8, z: 8 } }

const mountApp = (buildings: BuildingDef[] = []) =>
  mount(App, { props: { buildings }, global: { plugins: [createPinia()] } })

/** In the game, with the first-visit help still open. */
async function startedWithHelp(buildings: BuildingDef[] = [stub, camOnly]) {
  const w = mountApp(buildings)
  await w.find('[data-test="start-gate"]').trigger('pointerdown')
  await flushPromises()
  return w
}

/** In the game, walking around. */
async function started(buildings: BuildingDef[] = [stub, camOnly]) {
  const w = await startedWithHelp(buildings)
  await w.find('[data-test="help"]').trigger('pointerdown')
  vi.mocked(speak).mockClear()
  city.pause.mockClear()
  city.resume.mockClear()
  return w
}

const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('App', () => {
  beforeEach(() => {
    vi.mocked(unlockAudio).mockClear()
    vi.mocked(speak).mockClear()
    city.pause.mockClear()
    city.resume.mockClear()
    city.setDoors.mockClear()
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
      { id: 'stub', x: 2, z: 3, open: true, locked: false, icon: '🤸' },
      { id: 'touchy', x: 8, z: 8, open: false, locked: false, icon: '🤸' },
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
    expect(prompt.attributes('data-state')).toBe('open')
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
    expect(w.find('[data-test="door-prompt"]').attributes('data-state')).toBe('unavailable')
    w.unmount()
  })

  it('opens the building on enter and pauses the town', async () => {
    const w = await started()
    cityOptions.onNearDoor('stub')
    cityOptions.onEnter('stub')
    await flushPromises()
    expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
    expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
    expect(city.pause).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('awards the stars and returns to the town when the building finishes', async () => {
    const w = await started()
    cityOptions.onEnter('stub')
    await flushPromises()
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
    await flushPromises()
    finishWith({ stars: 0 })
    await nextTick()
    expect(w.find('[data-test="stars"]').text()).toBe('0')
    expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
    w.unmount()
  })

  it('ignores enter for an unknown door', async () => {
    const w = await started()
    cityOptions.onEnter('nowhere')
    await flushPromises()
    expect(city.pause).not.toHaveBeenCalled()
    w.unmount()
  })

  describe('daily goal and play buildings', () => {
    /** Walks into the earning stub and comes out with the given Stars. */
    async function visit(stars: number) {
      cityOptions.onEnter('stub')
      await flushPromises()
      finishWith({ stars })
      await nextTick()
    }
    const lastDoors = () => city.setDoors.mock.calls.at(-1)![0] as { id: string; open: boolean; locked: boolean }[]
    const playDoor = () => lastDoors().find(d => d.id === 'play')!
    const slots = (w: Awaited<ReturnType<typeof started>>) =>
      w.findAll('[data-test="goal-slot"]').map(s => s.attributes('data-done'))

    it('keeps a play building locked until two earning visits', async () => {
      const w = await started([stub, play])
      expect(cityOptions.doors.find(d => d.id === 'play')).toMatchObject({ open: false, locked: true })
      cityOptions.onNearDoor('play')
      await nextTick()
      expect(w.find('[data-test="door-prompt"]').attributes('data-state')).toBe('locked')
      expect(speak).toHaveBeenLastCalledWith('Erst lernen, dann spielen!')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      w.unmount()
    })

    it('shows the goal slots filling', async () => {
      const w = await started([stub, play])
      expect(slots(w)).toEqual(['false', 'false'])
      expect(w.find('[data-test="goal-prize"]').attributes('data-open')).toBe('false')
      await visit(4)
      expect(slots(w)).toEqual(['true', 'false'])
      await visit(4)
      expect(slots(w)).toEqual(['true', 'true'])
      expect(w.find('[data-test="goal-prize"]').attributes('data-open')).toBe('true')
      w.unmount()
    })

    it('counts an earning visit only when it earned stars', async () => {
      const w = await started([stub, play])
      await visit(0)
      await visit(0)
      expect(slots(w)).toEqual(['false', 'false'])
      w.unmount()
    })

    it('celebrates when the goal is reached and opens the play door', async () => {
      const w = await started([stub, play])
      await visit(2)
      expect(w.find('[data-test="confetti"]').exists()).toBe(false)
      await visit(2)
      expect(w.find('[data-test="confetti"]').exists()).toBe(true)
      expect(speak).toHaveBeenLastCalledWith('Geschafft! Die Spielhalle ist offen!')
      expect(playDoor()).toMatchObject({ open: true, locked: false })
      await visit(2)
      expect(vi.mocked(speak).mock.calls.filter(c => c[0] === 'Geschafft! Die Spielhalle ist offen!')).toHaveLength(1)
      w.unmount()
    })

    it('does not call the play door open while the stars are short', async () => {
      const w = await started([stub, play])
      await visit(1)
      await visit(1)
      expect(w.find('[data-test="confetti"]').exists()).toBe(true)
      expect(speak).toHaveBeenLastCalledWith('Geschafft! Jetzt brauchst du noch drei Sterne.')
      w.unmount()
    })

    it('says what is missing when there are too few stars', async () => {
      const w = await started([stub, play])
      await visit(1)
      await visit(1)
      expect(playDoor()).toMatchObject({ open: false, locked: false })
      cityOptions.onNearDoor('play')
      await nextTick()
      expect(w.find('[data-test="door-prompt"]').attributes('data-state')).toBe('poor')
      expect(speak).toHaveBeenLastCalledWith('Du brauchst drei Sterne.')
      w.unmount()
    })

    it('says the price at an open play door', async () => {
      const w = await started([stub, play])
      await visit(2)
      await visit(2)
      cityOptions.onNearDoor('play')
      await nextTick()
      expect(speak).toHaveBeenLastCalledWith('Spielhalle. Das kostet drei Sterne.')
      w.unmount()
    })

    it('charges the cost once on entering and never twice', async () => {
      const w = await started([stub, play])
      await visit(2)
      await visit(2)
      cityOptions.onEnter('play')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
      finishWith({ stars: 0 })
      await nextTick()
      expect(w.find('[data-test="stars"]').text()).toBe('1')
      w.unmount()
    })

    it('does not sell a second round to a child still standing in the doorway', async () => {
      const w = await started([stub, play])
      await visit(5)
      await visit(5)
      cityOptions.onNearDoor('play')
      cityOptions.onEnter('play')
      await flushPromises()
      finishWith({ stars: 0 })
      await nextTick()
      expect(w.find('[data-test="stars"]').text()).toBe('7')
      // still in front of the door: the same Enter that turned cards must not buy again
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      expect(w.find('[data-test="stars"]').text()).toBe('7')
      expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
      // walking away and back offers it again, with the price said aloud
      cityOptions.onNearDoor(null)
      cityOptions.onNearDoor('play')
      await nextTick()
      expect(speak).toHaveBeenLastCalledWith('Spielhalle. Das kostet drei Sterne.')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
      expect(w.find('[data-test="stars"]').text()).toBe('4')
      w.unmount()
    })

    it('takes no stars and stays in the town when a building cannot be loaded', async () => {
      const broken: BuildingDef = { ...play, preload: () => Promise.reject(new Error('offline')) }
      const w = await started([stub, broken])
      await visit(2)
      await visit(2)
      city.pause.mockClear()
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      expect(w.find('[data-test="stars"]').text()).toBe('4')
      expect(city.pause).not.toHaveBeenCalled()
      w.unmount()
    })

    it('charges once when Enter is pressed again while the building is loading', async () => {
      let loaded!: () => void
      const slow: BuildingDef = { ...play, preload: () => new Promise<void>(resolve => { loaded = resolve }) }
      const w = await started([stub, slow])
      await visit(2)
      await visit(2)
      cityOptions.onEnter('play')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stars"]').text()).toBe('4')
      loaded()
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
      expect(w.find('[data-test="stars"]').text()).toBe('1')
      w.unmount()
    })

    it('looks at the clock again at the door: no play just after midnight', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
      vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 30))
      try {
        const w = await started([stub, play])
        await visit(2)
        await visit(2)
        vi.setSystemTime(new Date(2026, 10, 13, 0, 0, 5))
        cityOptions.onEnter('play')
        await flushPromises()
        expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
        expect(w.find('[data-test="stars"]').text()).toBe('4')
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('notices a new day by itself within a minute', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
      vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 30))
      try {
        const w = await started([stub, play])
        await visit(2)
        await visit(2)
        vi.setSystemTime(new Date(2026, 10, 13, 0, 0, 5))
        vi.advanceTimersByTime(60_000)
        await nextTick()
        expect(slots(w)).toEqual(['false', 'false'])
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('gives no visit and no stars for a play building', async () => {
      const w = await started([stub, play])
      await visit(3)
      await visit(3)
      cityOptions.onEnter('play')
      await flushPromises()
      finishWith({ stars: 7 })
      await nextTick()
      expect(w.find('[data-test="stars"]').text()).toBe('3')
      expect(slots(w)).toEqual(['true', 'true'])
      w.unmount()
    })

    it('locks the play door again on a new day', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
      vi.setSystemTime(new Date(2026, 10, 12, 18, 0))
      try {
        const w = await started([stub, play])
        await visit(2)
        await visit(2)
        expect(playDoor().open).toBe(true)
        vi.setSystemTime(new Date(2026, 10, 13, 7, 0))
        document.dispatchEvent(new Event('visibilitychange'))
        await nextTick()
        expect(playDoor()).toMatchObject({ open: false, locked: true })
        expect(slots(w)).toEqual(['false', 'false'])
        expect(w.find('[data-test="stars"]').text()).toBe('4')
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('touch', () => {
    afterEach(() => Object.assign(device, { camera: true, touch: false, keyboard: true }))

    it('goes in when the picture at an open door is tapped', async () => {
      const w = await started()
      cityOptions.onNearDoor('stub')
      await nextTick()
      await w.find('[data-test="door-prompt"]').trigger('pointerdown')
      await w.find('[data-test="door-prompt"]').trigger('pointerup')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
      w.unmount()
    })

    it('charges once for a double tap at a play door', async () => {
      const w = await started([stub, play])
      for (const stars of [4, 4]) {
        cityOptions.onEnter('stub')
        await flushPromises()
        finishWith({ stars })
        await nextTick()
      }
      cityOptions.onNearDoor('play')
      await nextTick()
      const prompt = w.find('[data-test="door-prompt"]')
      for (let tap = 0; tap < 2; tap++) {
        void prompt.trigger('pointerdown')
        void prompt.trigger('pointerup')
      }
      await flushPromises()
      expect(usePlayerStore().stars).toBe(5)
      w.unmount()
    })

    it('shows the stick and the jump button on a touch screen only', async () => {
      let w = await started()
      expect(w.find('[data-test="jump"]').exists()).toBe(false)
      w.unmount()
      Object.assign(device, { touch: true, keyboard: false })
      w = await started()
      expect(w.find('[data-test="jump"]').exists()).toBe(true)
      expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
      cityOptions.onNearDoor('stub')
      await nextTick()
      expect(w.find('[data-test="tap"]').exists()).toBe(true)
      w.unmount()
    })
  })

  describe('leave button', () => {
    it('is shown only inside a building', async () => {
      const w = await started()
      expect(w.find('[data-test="leave"]').exists()).toBe(false)
      cityOptions.onEnter('stub')
      await flushPromises()
      expect(w.find('[data-test="leave"]').exists()).toBe(true)
      finishWith({ stars: 0 })
      await nextTick()
      expect(w.find('[data-test="leave"]').exists()).toBe(false)
      w.unmount()
    })
  })

  describe('help', () => {
    it('shows the controls to a new player, reads them out and holds the town', async () => {
      const w = await startedWithHelp()
      const help = w.find('[data-test="help"]')
      expect(help.exists()).toBe(true)
      expect(help.findAll('[data-test="help-row"]')).toHaveLength(4)
      expect(vi.mocked(speak).mock.calls[0][0]).toContain('Pfeiltasten')
      expect(city.pause).toHaveBeenCalledTimes(1)
      w.unmount()
    })

    it('closes on any key and lets the town go on', async () => {
      const w = await startedWithHelp()
      key('ArrowLeft')
      await nextTick()
      expect(w.find('[data-test="help"]').exists()).toBe(false)
      expect(city.resume).toHaveBeenCalledTimes(1)
      w.unmount()
    })

    it('stays open while the start key is still held down, and for bare modifier keys', async () => {
      const w = await startedWithHelp()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', repeat: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', key: 'Control' }))
      await nextTick()
      expect(w.find('[data-test="help"]').exists()).toBe(true)
      w.unmount()
    })

    it('does not flicker when H is held down', async () => {
      const w = await started()
      key('KeyH')
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', repeat: true }))
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', repeat: true }))
      await nextTick()
      expect(w.find('[data-test="help"]').exists()).toBe(true)
      w.unmount()
    })

    it('is not shown again to a player who has played before, even with 0 Stars', async () => {
      const pinia = createPinia()
      const player = usePlayerStore(pinia)
      player.award(3)
      player.recordVisit()
      player.spend(3)
      const w = mount(App, { props: { buildings: [stub] }, global: { plugins: [pinia] } })
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="help"]').exists()).toBe(false)
      w.unmount()
    })

    it('is not shown at the start to a player who already has Stars', async () => {
      const pinia = createPinia()
      usePlayerStore(pinia).award(3)
      const w = mount(App, { props: { buildings: [stub] }, global: { plugins: [pinia] } })
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="help"]').exists()).toBe(false)
      w.unmount()
    })

    it.each(['KeyH', 'F1'])('opens with %s', async code => {
      const w = await started()
      key(code)
      await nextTick()
      expect(w.find('[data-test="help"]').exists()).toBe(true)
      expect(city.pause).toHaveBeenCalledTimes(1)
      w.unmount()
    })

    it('opens with the question mark button', async () => {
      const w = await started()
      await w.find('[data-test="help-button"]').trigger('pointerdown')
      expect(w.find('[data-test="help"]').exists()).toBe(true)
      w.unmount()
    })

    it('does not open inside a building', async () => {
      const w = await started()
      cityOptions.onEnter('stub')
      await flushPromises()
      key('KeyH')
      await nextTick()
      expect(w.find('[data-test="help"]').exists()).toBe(false)
      expect(w.find('[data-test="help-button"]').exists()).toBe(false)
      w.unmount()
    })

    it('hides the door prompt while open', async () => {
      const w = await started()
      cityOptions.onNearDoor('stub')
      key('KeyH')
      await nextTick()
      expect(w.find('[data-test="door-prompt"]').exists()).toBe(false)
      w.unmount()
    })
  })
})
