import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CityView from './CityView.vue'
import { createCity, type CityOptions } from './city'
import type { DoorDef } from './doors'

vi.mock('./city', () => ({ createCity: vi.fn() }))

const doors: DoorDef[] = [{ id: 'yoga', x: 0, z: -14, open: true }]

describe('CityView', () => {
  const city = { pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(), setDoors: vi.fn() }
  let options: CityOptions

  beforeEach(() => {
    city.pause.mockClear()
    city.resume.mockClear()
    city.dispose.mockClear()
    city.setDoors.mockClear()
    vi.mocked(createCity).mockReset().mockImplementation(async opts => {
      options = opts
      return city
    })
  })

  it('creates the city with the given doors and disposes it on unmount', async () => {
    const w = mount(CityView, { props: { doors, paused: false } })
    await flushPromises()
    expect(createCity).toHaveBeenCalledTimes(1)
    expect(options.doors).toEqual(doors)
    expect(options.canvas).toBeInstanceOf(HTMLCanvasElement)
    w.unmount()
    expect(city.dispose).toHaveBeenCalledTimes(1)
  })

  it('pauses and resumes when the paused prop changes', async () => {
    const w = mount(CityView, { props: { doors, paused: false } })
    await flushPromises()
    await w.setProps({ paused: true })
    expect(city.pause).toHaveBeenCalledTimes(1)
    await w.setProps({ paused: false })
    expect(city.resume).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('passes changed doors on to the town, but not the first ones again', async () => {
    const w = mount(CityView, { props: { doors, paused: false } })
    await flushPromises()
    expect(city.setDoors).not.toHaveBeenCalled()
    const changed = [{ ...doors[0], open: false, locked: true }]
    await w.setProps({ doors: changed })
    expect(city.setDoors).toHaveBeenCalledTimes(1)
    expect(city.setDoors).toHaveBeenCalledWith(changed)
    w.unmount()
  })

  it('gives the town the doors as they are once it has loaded', async () => {
    let finish!: (c: typeof city) => void
    vi.mocked(createCity).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const w = mount(CityView, { props: { doors, paused: false } })
    const changed = [{ ...doors[0], open: false }]
    await w.setProps({ doors: changed })
    finish(city)
    await flushPromises()
    expect(city.setDoors).toHaveBeenCalledWith(changed)
    w.unmount()
  })

  it('starts paused when mounted paused', async () => {
    const w = mount(CityView, { props: { doors, paused: true } })
    await flushPromises()
    expect(city.pause).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('emits near-door and enter from the city callbacks', async () => {
    const w = mount(CityView, { props: { doors, paused: false } })
    await flushPromises()
    options.onNearDoor('yoga')
    options.onNearDoor(null)
    options.onEnter('yoga')
    expect(w.emitted('near-door')).toEqual([['yoga'], [null]])
    expect(w.emitted('enter')).toEqual([['yoga']])
    w.unmount()
  })

  it('disposes a city that finishes loading after unmount', async () => {
    let finish!: (c: typeof city) => void
    vi.mocked(createCity).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const w = mount(CityView, { props: { doors, paused: false } })
    w.unmount()
    finish(city)
    await flushPromises()
    expect(city.dispose).toHaveBeenCalledTimes(1)
  })

  describe('touch controls', () => {
    it('are shown on a touch device and feed the town', async () => {
      const w = mount(CityView, { props: { doors, paused: false, touch: true } })
      await flushPromises()
      await w.find('[data-test="jump"]').trigger('pointerdown')
      expect(options.intents.read().jump).toBe(true)
      expect(options.intents.read().jump).toBe(false)
      w.unmount()
    })

    it('still take the keys', async () => {
      const w = mount(CityView, { props: { doors, paused: false, touch: true } })
      await flushPromises()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
      expect(options.intents.read().jump).toBe(true)
      w.unmount()
    })

    it('are hidden while the town is paused', async () => {
      const w = mount(CityView, { props: { doors, paused: false, touch: true } })
      await flushPromises()
      await w.setProps({ paused: true })
      expect(w.find('[data-test="jump"]').exists()).toBe(false)
      w.unmount()
    })

    it('are absent without a touch screen', async () => {
      const w = mount(CityView, { props: { doors, paused: false } })
      await flushPromises()
      expect(w.find('[data-test="jump"]').exists()).toBe(false)
      w.unmount()
    })
  })
})
