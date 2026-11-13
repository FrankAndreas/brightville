import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import App from './App.vue'
import { createCity, type CityOptions } from './city/city'
import { unlockAudio } from './services/sound'
import { forgetInstruction, speak } from './services/tts'
import type { BuildingDef, BuildingResult } from './buildings/types'
import { fakeApi, type FakeApi } from './services/fakeApi'
import { ApiError } from './services/api'
import { usePlayerStore } from './stores/player'
import { useSessionStore } from './stores/session'

vi.mock('./city/city', () => ({ createCity: vi.fn() }))
vi.mock('./city/preview', () => ({ createPreview: () => ({ setDress: vi.fn(), dispose: vi.fn() }) }))
vi.mock('./services/sound', () => ({ unlockAudio: vi.fn(), playBeat: vi.fn() }))
vi.mock('./services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})
const device = vi.hoisted(() => ({ camera: true, touch: false, keyboard: true }))
vi.mock('./services/device', () => ({ detectDevice: () => ({ ...device }) }))

const city = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(), setDoors: vi.fn(), setDress: vi.fn() }
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

/** The server of the running test: Mia, a child, with what the test gives her */
let api: FakeApi

const mountApp = (buildings: BuildingDef[] = [], server: FakeApi = api) =>
  mount(App, { props: { buildings, api: server }, global: { plugins: [createPinia()] } })

/** In the game, with the first-visit help still open. */
async function startedWithHelp(buildings: BuildingDef[] = [stub, camOnly], server: FakeApi = api) {
  const w = mountApp(buildings, server)
  await w.find('[data-test="start-gate"]').trigger('pointerdown')
  await flushPromises()
  return w
}

/** In the game, walking around. */
async function started(buildings: BuildingDef[] = [stub, camOnly], server: FakeApi = api) {
  const w = await startedWithHelp(buildings, server)
  const help = w.find('[data-test="help"]')
  if (help.exists()) await help.trigger('pointerdown')
  vi.mocked(speak).mockClear()
  city.pause.mockClear()
  city.resume.mockClear()
  return w
}

const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('App', () => {
  beforeEach(() => {
    api = fakeApi()
    window.localStorage.clear()
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
    await flushPromises()
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
      { id: 'stub', x: 2, z: 3, side: 'back', open: true, locked: false, icon: '🤸' },
      { id: 'touchy', x: 8, z: 8, side: 'back', open: false, locked: false, icon: '🤸' },
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
      await flushPromises()
    }
    // The doors the town shows now: the last change, or the first ones
    const lastDoors = () => (city.setDoors.mock.calls.at(-1)?.[0] ?? cityOptions.doors) as { id: string; open: boolean; locked: boolean }[]
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

    it('asks the server at the door: no play once its day has turned', async () => {
      const w = await started([stub, play])
      await visit(2)
      await visit(2)
      api.newDay('2026-11-13')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      expect(w.find('[data-test="stars"]').text()).toBe('4')
      expect(speak).toHaveBeenLastCalledWith('Erst lernen, dann spielen!')
      w.unmount()
    })

    it('notices a new day by itself within a minute', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      try {
        const w = await started([stub, play])
        await visit(2)
        await visit(2)
        api.newDay('2026-11-13')
        vi.advanceTimersByTime(60_000)
        await flushPromises()
        expect(slots(w)).toEqual(['false', 'false'])
        expect(playDoor()).toMatchObject({ open: false, locked: true })
        expect(w.find('[data-test="stars"]').text()).toBe('4')
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

    it('looks again when the page comes back into view', async () => {
      const w = await started([stub, play])
      await visit(2)
      await visit(2)
      api.newDay('2026-11-13')
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(playDoor()).toMatchObject({ open: false, locked: true })
      w.unmount()
    })

    it('follows the child\'s own daily goal', async () => {
      api.state_.daily_goal = 3
      const w = await started([stub, play])
      expect(slots(w)).toEqual(['false', 'false', 'false'])
      await visit(1)
      await visit(1)
      expect(playDoor()).toMatchObject({ locked: true })
      w.unmount()
    })

    it('closes the play door with a moon once today\'s play time is used up', async () => {
      Object.assign(api.state_, { stars: 10, visits: 2, play_minutes: 10, play_seconds: 600 })
      const w = await started([stub, play])
      expect(playDoor()).toMatchObject({ open: false, locked: false })
      cityOptions.onNearDoor('play')
      await nextTick()
      expect(w.find('[data-test="door-prompt"]').attributes('data-state')).toBe('timeUp')
      expect(speak).toHaveBeenLastCalledWith('Für heute ist genug gespielt. Morgen wieder!')
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      expect(w.find('[data-test="stars"]').text()).toBe('10')
      w.unmount()
    })

    it('keeps a building that needs films closed until the parents chose some', async () => {
      const kino: BuildingDef = { ...play, id: 'kino', spokenName: 'Kino', needs: ['films'], door: { x: 8, z: -8 } }
      Object.assign(api.state_, { stars: 10, visits: 2 })
      const w = await started([stub, kino])
      const kinoDoor = () => ((city.setDoors.mock.calls.at(-1)?.[0] ?? cityOptions.doors) as { id: string; open: boolean }[])
        .find(d => d.id === 'kino')
      expect(kinoDoor()).toMatchObject({ open: false })
      api.films_ = [{ id: 1, youtube_id: 'dQw4w9WgXcQ', title: '' }]
      await usePlayerStore().refresh()
      await nextTick()
      expect(kinoDoor()).toMatchObject({ open: true })
      w.unmount()
    })

    it('opens a free building before the goal, with no Stars and after the play time, and asks the server nothing', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        const free: BuildingDef = { ...stub, id: 'free', spokenName: 'Malen', kind: 'free', door: { x: -8, z: -8 } }
        Object.assign(api.state_, { stars: 0, visits: 0, play_minutes: 10, play_seconds: 600 })
        const w = await started([stub, play, free])
        const freeDoor = () => ((city.setDoors.mock.calls.at(-1)?.[0] ?? cityOptions.doors) as { id: string; open: boolean }[])
          .find(d => d.id === 'free')
        expect(freeDoor()).toMatchObject({ open: true })
        cityOptions.onNearDoor('free')
        expect(speak).toHaveBeenLastCalledWith('Malen')
        api.calls.length = 0
        cityOptions.onEnter('free')
        await flushPromises()
        expect(w.find('[data-test="stub-building"]').exists()).toBe(true)
        vi.advanceTimersByTime(65_000)
        finishWith({ stars: 7 })
        await flushPromises()
        expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
        expect(api.calls.filter(c => /^(play|visit)/.test(c))).toEqual([])
        expect(api.state_).toMatchObject({ stars: 0, visits: 0, play_seconds: 600 })
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('counts the time spent in a play building', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        Object.assign(api.state_, { stars: 10, visits: 2 })
        const w = await started([stub, play])
        cityOptions.onEnter('play')
        await flushPromises()
        vi.advanceTimersByTime(65_000)
        finishWith({ stars: 0 })
        await flushPromises()
        expect(api.state_.play_seconds).toBe(65)
        expect(api.calls.filter(c => c.startsWith('playTime'))).toEqual(['playTime 30', 'playTime 30', 'playTime 5'])
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('counts no more than a moment for time the iPad slept in a play building', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      try {
        Object.assign(api.state_, { stars: 10, visits: 2 })
        const w = await started([stub, play])
        cityOptions.onEnter('play')
        await flushPromises()
        vi.setSystemTime(Date.now() + 8 * 3600_000)
        vi.advanceTimersByTime(30_000)
        finishWith({ stars: 0 })
        await flushPromises()
        expect(api.state_.play_seconds).toBeLessThanOrEqual(45)
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps earned stars when the server is away, and sends them later', async () => {
      const w = await started([stub, play])
      api.offline = true
      await visit(5)
      expect(w.find('[data-test="stars"]').text()).toBe('5')
      expect(slots(w)).toEqual(['true', 'false'])
      api.offline = false
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(api.state_.stars).toBe(5)
      expect(w.find('[data-test="stars"]').text()).toBe('5')
      w.unmount()
    })

    it('takes no stars and stays outside when the server cannot be asked at the door', async () => {
      Object.assign(api.state_, { stars: 10, visits: 2 })
      const w = await started([stub, play])
      api.offline = true
      cityOptions.onEnter('play')
      await flushPromises()
      expect(w.find('[data-test="stub-building"]').exists()).toBe(false)
      expect(w.find('[data-test="stars"]').text()).toBe('10')
      w.unmount()
    })
  })

  describe('who plays', () => {
    const PEOPLE = [
      { id: 1, name: 'Kind', role: 'CHILD' as const, color: '#ff9a3c' },
      { id: 2, name: 'Eltern', role: 'PARENT' as const, color: '#4f8fe8' },
    ]

    it('shows the player\'s first letter in their colour', async () => {
      const w = await started()
      const who = w.find('[data-test="who"]')
      expect(who.text()).toBe('M')
      expect(who.attributes('style')).toContain('background')
      w.unmount()
    })

    it('without a hub, asks who plays and then starts the game for them', async () => {
      const server = fakeApi({}, { mode: 'local', person: null, people: PEOPLE, login_url: null, logout_url: null })
      const w = mountApp([stub], server)
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="who-plays"]').exists()).toBe(true)
      expect(w.find('[data-test="game"]').exists()).toBe(false)
      await w.find('[data-test="person"][data-id="1"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="game"]').exists()).toBe(true)
      expect(w.find('[data-test="who"]').text()).toBe('K')
      // without a hub the badge hands the game to someone else
      if (w.find('[data-test="help"]').exists()) await w.find('[data-test="help"]').trigger('pointerdown')
      await w.find('[data-test="who"]').trigger('pointerdown')
      expect(w.find('[data-test="who-plays"]').exists()).toBe(true)
      w.unmount()
    })

    it('with a hub, the badge does nothing', async () => {
      const w = await started()
      await w.find('[data-test="who"]').trigger('pointerdown')
      expect(w.find('[data-test="who-plays"]').exists()).toBe(false)
      w.unmount()
    })

    it('shows a sleeping cloud when the server does not answer, and starts once it does', async () => {
      const server = fakeApi()
      server.offline = true
      const w = mountApp([stub], server)
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="server-screen"]').attributes('data-kind')).toBe('offline')
      server.offline = false
      await w.find('[data-test="server-screen"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="game"]').exists()).toBe(true)
      w.unmount()
    })

    it('shows a closed door to someone who may not play', async () => {
      const server = fakeApi()
      server.me = async () => { throw new ApiError(403, 'no_access') }
      const w = mountApp([stub], server)
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="server-screen"]').attributes('data-kind')).toBe('no_access')
      expect(w.find('[data-test="game"]').exists()).toBe(false)
      w.unmount()
    })
  })

  describe('the hub login during play', () => {
    async function withNavigation(server: FakeApi = api) {
      const go = vi.fn()
      const pinia = createPinia()
      await useSessionStore(pinia).start(server, go)
      const w = mount(App, { props: { buildings: [stub, play], api: server }, global: { plugins: [pinia] } })
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      if (w.find('[data-test="help"]').exists()) await w.find('[data-test="help"]').trigger('pointerdown')
      return { w, go, session: useSessionStore(pinia) }
    }

    it('goes to the hub when the login ends mid-game', async () => {
      const { w, go } = await withNavigation()
      api.me = async () => { throw new ApiError(401, 'not_logged_in', 'https://hub.test/?next=') }
      api.state = async () => { throw new ApiError(401, 'not_logged_in', 'https://hub.test/?next=') }
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(go).toHaveBeenCalledWith(`https://hub.test/?next=${encodeURIComponent(window.location.href)}`)
      w.unmount()
    })

    it('shows the closed door when access is taken away mid-game', async () => {
      const { w } = await withNavigation()
      api.me = async () => { throw new ApiError(403, 'no_access') }
      api.state = async () => { throw new ApiError(403, 'no_access') }
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(w.find('[data-test="server-screen"]').attributes('data-kind')).toBe('no_access')
      w.unmount()
    })

    it('renews a login in its last week while the child walks around, not inside a building', async () => {
      const { w, go, session } = await withNavigation()
      cityOptions.onEnter('stub')
      await flushPromises()
      session.wantRenew()
      await flushPromises()
      expect(go).not.toHaveBeenCalled()
      finishWith({ stars: 0 })
      await flushPromises()
      expect(go).toHaveBeenCalledWith(`https://hub.test/?next=${encodeURIComponent(window.location.href)}`)
      w.unmount()
    })
  })

  describe('her look', () => {
    it('lets a new player design her character before the town, then keeps it', async () => {
      api.wardrobe_.look = null
      const w = await startedWithHelp()
      expect(w.find('[data-test="look-screen"]').exists()).toBe(true)
      expect(w.find('[data-test="game"]').exists()).toBe(false)
      await w.findAll('[data-test="look-body"]')[1].trigger('click')
      await w.find('[data-test="look-done"]').trigger('click')
      await flushPromises()
      expect(api.calls).toContain('saveLook')
      expect(api.wardrobe_.look).toMatchObject({ body: '#4f8fe8' })
      expect(w.find('[data-test="look-screen"]').exists()).toBe(false)
      expect(w.find('[data-test="game"]').exists()).toBe(true)
      // The help for a new player comes after her look
      expect(w.find('[data-test="help"]').exists()).toBe(true)
      w.unmount()
    })

    it('goes straight to the town for someone who chose her look before', async () => {
      const w = await started()
      expect(w.find('[data-test="look-screen"]').exists()).toBe(false)
      expect(w.find('[data-test="game"]').exists()).toBe(true)
      w.unmount()
    })
  })

  describe('parents', () => {
    it('get a gear that opens their page over the paused town; children do not', async () => {
      let w = await started()
      expect(w.find('[data-test="parents-button"]').exists()).toBe(false)
      w.unmount()
      const server = fakeApi({}, { person: { id: 7, name: 'Papa', role: 'PARENT', color: null } })
      w = await started([stub], server)
      // Through the gate: the gear opens a question first, and only the right answer opens the page
      await w.find('[data-test="parents-button"]').trigger('keydown', { key: 'Enter' })
      const question = w.find('[data-test="parents-question"]')
      const product = Number(question.attributes('data-a')) * Number(question.attributes('data-b'))
      await w.find('[data-test="parents-answer"]').setValue(String(product))
      await w.find('form').trigger('submit')
      await flushPromises()
      expect(w.find('[data-test="parent-area"]').exists()).toBe(true)
      expect(city.pause).toHaveBeenCalled()
      expect(w.find('[data-test="help-button"]').exists()).toBe(false)
      await w.find('[data-test="parent-close"]').trigger('click')
      expect(w.find('[data-test="parent-area"]').exists()).toBe(false)
      w.unmount()
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
      expect(help.findAll('[data-test="help-row"]')).toHaveLength(5)
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

    it('is not shown again to a player who has seen it on this device, even with 0 Stars', async () => {
      let w = await startedWithHelp()
      await w.find('[data-test="help"]').trigger('pointerdown')
      w.unmount()
      w = mountApp([stub])
      await w.find('[data-test="start-gate"]').trigger('pointerdown')
      await flushPromises()
      expect(w.find('[data-test="help"]').exists()).toBe(false)
      w.unmount()
    })

    it('is not shown at the start to a player who already has Stars', async () => {
      api.state_.stars = 3
      const w = mountApp([stub])
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

  describe('stickers and the logbook', () => {
    const row = (id: string) => ({ id, earned_at: '2026-11-12T10:00:00+01:00', seen: false })

    it('forgets a building\'s instruction when the child goes in and when she comes out', async () => {
      const w = await started()
      vi.mocked(forgetInstruction).mockClear()
      cityOptions.onEnter('stub')
      await flushPromises()
      expect(forgetInstruction).toHaveBeenCalledTimes(1)
      finishWith({ stars: 0 })
      await flushPromises()
      expect(forgetInstruction).toHaveBeenCalledTimes(2)
      w.unmount()
    })

    it('records a visit to Malen in which something was made, but not an empty one, nor one to the house', async () => {
      const malen: BuildingDef = { ...stub, id: 'malen', spokenName: 'Malen', kind: 'free', door: { x: -8, z: -8 } }
      const haus: BuildingDef = { ...stub, id: 'haus', spokenName: 'Mein Haus', kind: 'free', unlogged: true, door: { x: 8, z: -8 } }
      const w = await started([malen, haus])
      for (const [id, made] of [['malen', false], ['malen', true], ['haus', true]] as const) {
        cityOptions.onEnter(id)
        await flushPromises()
        finishWith({ stars: 0, made })
        await flushPromises()
      }
      expect(api.calls.filter(c => c.startsWith('freeVisit'))).toEqual(['freeVisit malen'])
      w.unmount()
    })

    it('celebrates new stickers in the town, one after another, at most three, then counts them seen', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      try {
        api.stickers_ = [row('rechenprofi'), row('buecherwurm'), row('springfloh'), row('tanzstern')]
        const w = await started()
        await flushPromises()
        const shown = () => w.find('[data-test="sticker-parade"]')
        expect(shown().attributes('data-id')).toBe('rechenprofi')
        await vi.advanceTimersByTimeAsync(3600)
        expect(shown().attributes('data-id')).toBe('buecherwurm')
        expect(speak).toHaveBeenLastCalledWith('Ein neuer Sticker: Bücherwurm!')
        await vi.advanceTimersByTimeAsync(3600 * 2)
        expect(shown().exists()).toBe(false)
        expect(api.calls).toContain('stickersSeen rechenprofi,buecherwurm,springfloh')
        // The fourth waits in the album as new
        expect(usePlayerStore().unseen).toEqual(['tanzstern'])
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('celebrates a sticker a visit earned once the child is back in the town', async () => {
      const w = await started()
      cityOptions.onEnter('stub')
      await flushPromises()
      api.earns_ = ['rechenprofi']
      finishWith({ stars: 5 })
      await flushPromises()
      expect(w.find('[data-test="sticker-parade"]').attributes('data-id')).toBe('rechenprofi')
      w.unmount()
    })

    it('does not celebrate inside a building', async () => {
      const w = await started()
      cityOptions.onEnter('stub')
      await flushPromises()
      api.stickers_ = [row('rechenprofi')]
      await usePlayerStore().refresh()
      await flushPromises()
      expect(w.find('[data-test="sticker-parade"]').exists()).toBe(false)
      w.unmount()
    })
  })
})

