import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Intents, IntentSource } from '@/input/intents'
import { BUILDINGS } from '@/buildings/registry'
import type { CharacterFrame } from './character'
import type { DoorDef } from './doors'
import { STOPS } from './map'
import { doorTarget, type RideTarget } from './ride'

// No WebGL in tests: a stand-in renderer. The town, the physics and the frame loop are the real ones.
const renderer = vi.hoisted(() => ({
  setPixelRatio: () => {}, setSize: () => {}, render: vi.fn(), dispose: () => {},
  shadowMap: { enabled: false }, info: { render: { calls: 0, triangles: 0 } },
}))
vi.mock('three', async importOriginal => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: vi.fn(function () { return renderer }) }))

import { createCity, type City } from './city'

const FRAME_MS = 1000 / 60
const doors: DoorDef[] = BUILDINGS.map(b => ({ id: b.id, x: b.door.x, z: b.door.z, side: b.door.side ?? 'back', open: true }))
const farm = (() => {
  const s = STOPS.find(t => t.id === 'bauernhof')!
  return { x: s.x, z: s.z, face: s.face }
})()
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

const none = (): Intents => ({ moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false })

/** Keys held and pressed, as the town reads them: a press counts for one read */
function fakeIntents() {
  const held = none()
  const source: IntentSource = {
    read() {
      const out = { ...held }
      held.jump = held.interact = held.leave = held.turnAround = held.lookHome = false
      return out
    },
    reset() {
      Object.assign(held, none())
    },
    dispose() {},
  }
  return { held, source }
}

let callbacks: FrameRequestCallback[] = []
let now = 0

/** Runs the town's frames */
function frames(n: number) {
  for (let i = 0; i < n; i++) {
    now += FRAME_MS
    const due = callbacks
    callbacks = []
    for (const cb of due) cb(now)
  }
}
const seconds = (s: number) => frames(Math.round(s * 60))
const her = () => (window as unknown as { __city: { frame: CharacterFrame } }).__city.frame

async function town(initial = doors) {
  const keys = fakeIntents()
  const onEnter = vi.fn()
  const onNearDoor = vi.fn()
  const onRideEnd = vi.fn()
  const city: City = await createCity({
    canvas: document.createElement('canvas'), intents: keys.source, doors: initial, onEnter, onNearDoor, onRideEnd,
  })
  // Settle on the ground
  seconds(0.5)
  return { city, keys, onEnter, onNearDoor, onRideEnd }
}

/** Frames until the ride ends, at most `limit` seconds */
function rideUntilEnd(onRideEnd: ReturnType<typeof vi.fn>, limit = 60) {
  for (let i = 0; i < limit * 60 && onRideEnd.mock.calls.length === 0; i++) frames(1)
}

describe('riding the bicycle in the town', () => {
  let city: City | null = null

  beforeEach(() => {
    callbacks = []
    now = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => callbacks.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => { callbacks = [] })
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    city?.dispose()
    city = null
    vi.unstubAllGlobals()
  })

  it('rides from the start to the farm stop, ends at the stop facing its way, and never enters', async () => {
    const t = await town()
    city = t.city
    expect(city.rideTo(farm)).toBe('riding')
    rideUntilEnd(t.onRideEnd)
    expect(t.onRideEnd).toHaveBeenCalledWith('arrived')
    // She turns to face the stop's way
    seconds(0.5)
    const at = city.position()
    expect(Math.hypot(at.x - farm.x, at.z - farm.z)).toBeLessThan(0.5)
    expect(angleGap(her().heading, farm.face)).toBeLessThan(0.1)
    expect(t.onEnter).not.toHaveBeenCalled()
    expect(t.onRideEnd).toHaveBeenCalledTimes(1)
  }, 60_000)

  it('swings the view round behind her after she arrives, so she looks the way of the stop, away from the camera', async () => {
    const t = await town()
    city = t.city
    city.rideTo(farm)
    rideUntilEnd(t.onRideEnd)
    expect(t.onRideEnd).toHaveBeenCalledWith('arrived')
    seconds(2)
    const camera = renderer.render.mock.lastCall![1] as { position: { x: number; z: number } }
    const at = her()
    expect(angleGap(Math.atan2(at.x - camera.position.x, at.z - camera.position.z), farm.face)).toBeLessThan(0.2)
  }, 60_000)

  it('rides past the doors without stopping at each: no door is near until she gets off', async () => {
    const t = await town()
    city = t.city
    t.onNearDoor.mockClear()
    city.rideTo(farm)
    rideUntilEnd(t.onRideEnd)
    // The avenue to the farm passes a dozen doors (the farm stop itself has none)
    expect(t.onNearDoor.mock.calls.filter(([id]) => id !== null)).toEqual([])
  }, 60_000)

  it('answers "there" when she is already there', async () => {
    const t = await town()
    city = t.city
    const p = city.position()
    expect(city.rideTo({ x: p.x + 1, z: p.z, face: 0 })).toBe('there')
    seconds(0.5)
    expect(t.onRideEnd).not.toHaveBeenCalled()
  }, 60_000)

  it('stops within half a second when she presses a walk key, then walks as usual', async () => {
    const t = await town()
    city = t.city
    city.rideTo(farm)
    seconds(3)
    expect(her().speed).toBeGreaterThan(6)
    t.keys.held.moveX = 1
    frames(1)
    expect(t.onRideEnd).toHaveBeenCalledWith('stopped')
    seconds(0.5)
    // Walking speed, steered by her
    expect(her().speed).toBeGreaterThan(3)
    expect(her().speed).toBeLessThan(4.5)
    t.keys.held.moveX = 0
    seconds(0.5)
    expect(her().speed).toBeLessThan(0.5)
    expect(t.onRideEnd).toHaveBeenCalledTimes(1)
  }, 60_000)

  it('stops within half a second on a jump, a turn, a turn-around or a look home', async () => {
    const t = await town()
    city = t.city
    const presses: ((h: Intents) => void)[] = [
      h => { h.jump = true },
      h => { h.turn = 1 },
      h => { h.turnAround = true },
      h => { h.lookHome = true },
    ]
    for (const press of presses) {
      t.onRideEnd.mockClear()
      city.rideTo(farm)
      seconds(2)
      press(t.keys.held)
      frames(1)
      t.keys.held.turn = 0
      expect(t.onRideEnd).toHaveBeenCalledWith('stopped')
      seconds(0.5)
      expect(her().speed).toBeLessThan(0.5)
    }
  }, 60_000)

  it('is cancelled by pause, and resume never takes it up again', async () => {
    const t = await town()
    city = t.city
    city.rideTo(farm)
    seconds(2)
    city.pause()
    city.resume()
    seconds(0.6)
    const a = city.position()
    seconds(1)
    const b = city.position()
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.05)
    expect(t.onRideEnd).not.toHaveBeenCalledWith('arrived')
  }, 60_000)

  it('rides to the new target when given one mid-ride', async () => {
    const t = await town()
    city = t.city
    city.rideTo(farm)
    seconds(2)
    const school = doorTarget(BUILDINGS[0].door)
    expect(city.rideTo(school)).toBe('riding')
    rideUntilEnd(t.onRideEnd)
    expect(t.onRideEnd.mock.calls).toEqual([['arrived']])
    const at = city.position()
    expect(Math.hypot(at.x - school.x, at.z - school.z)).toBeLessThan(0.5)
  }, 60_000)

  it('shows the door as it is on arrival, when it opened mid-ride, and never enters by itself', async () => {
    const target = doors[1]
    const t = await town(doors.map(d => (d.id === target.id ? { ...d, open: false } : d)))
    city = t.city
    const to: RideTarget = doorTarget(target)
    city.rideTo(to)
    seconds(1)
    city.setDoors(doors)
    rideUntilEnd(t.onRideEnd)
    expect(t.onRideEnd).toHaveBeenCalledWith('arrived')
    seconds(0.2)
    expect(t.onNearDoor).toHaveBeenLastCalledWith(target.id)
    expect(t.onEnter).not.toHaveBeenCalled()
    // She still enters herself
    t.keys.held.interact = true
    frames(1)
    expect(t.onEnter).toHaveBeenCalledWith(target.id)
  }, 60_000)

  it('cannot enter a door that locked mid-ride', async () => {
    const target = doors[1]
    const t = await town()
    city = t.city
    city.rideTo(doorTarget(target))
    seconds(1)
    city.setDoors(doors.map(d => (d.id === target.id ? { ...d, open: false, locked: true } : d)))
    rideUntilEnd(t.onRideEnd)
    expect(t.onRideEnd).toHaveBeenCalledWith('arrived')
    seconds(0.2)
    t.keys.held.interact = true
    frames(1)
    expect(t.onEnter).not.toHaveBeenCalled()
  }, 60_000)
})
