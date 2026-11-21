import { describe, expect, it, vi } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import type { Intents } from '@/input/intents'
import { START, STOPS } from './map'
import { createRider, type RiderSpot } from './rider'
import { walkGrid } from './walkable'

const grid = walkGrid(BUILDINGS.map(b => b.door))
const DT = 1 / 60
const farm = (() => {
  const s = STOPS.find(t => t.id === 'bauernhof')!
  return { x: s.x, z: s.z, face: s.face }
})()
const none: Intents = { moveX: 0, moveZ: 0, jump: false, interact: false, leave: false, turn: 0, turnAround: false, lookHome: false }

function setup() {
  const onEnd = vi.fn()
  const rider = createRider(() => grid, onEnd)
  const her: RiderSpot = { x: START.x, z: START.z, grounded: true, tumbling: false, event: null }
  /** One frame: she moves exactly as steered, unless `frozen` */
  const frame = (intents = none, dt = DT, frozen = false) => {
    const c = rider.step(intents, her, dt)
    if (c && !frozen) {
      her.x += c.moveX * c.speed * dt
      her.z += c.moveZ * c.speed * dt
    }
    return c
  }
  return { rider, her, onEnd, frame }
}

describe('the rider', () => {
  it('answers "there" when she is already at the target, and starts nothing', () => {
    const { rider, frame, onEnd } = setup()
    expect(rider.rideTo({ x: START.x + 1, z: START.z, face: 0 }, START)).toBe('there')
    expect(frame()).toBeNull()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('rides her to the target, then ends as arrived and turns her to its face until she moves', () => {
    const { rider, her, frame, onEnd } = setup()
    expect(rider.rideTo(farm, her)).toBe('riding')
    for (let i = 0; i < 60 * 60 && !onEnd.mock.calls.length; i++) frame()
    expect(onEnd.mock.calls).toEqual([['arrived']])
    expect(Math.hypot(her.x - farm.x, her.z - farm.z)).toBeLessThan(0.5)
    expect(rider.onBike).toBe(false)
    expect(frame()).toBeNull()
    expect(rider.facing).toBe(farm.face)
    frame({ ...none, moveX: 1 })
    expect(rider.facing).toBeNull()
  })

  it('waits for her to stand: in the air or tumbling, nothing moves and the bike is not out yet', () => {
    const { rider, her, frame } = setup()
    rider.rideTo(farm, her)
    her.grounded = false
    for (let i = 0; i < 30; i++) {
      const c = frame()!
      expect(c.speed).toBe(0)
      expect(rider.onBike).toBe(false)
    }
    her.grounded = true
    her.tumbling = true
    expect(frame()!.speed).toBe(0)
    her.tumbling = false
    frame()
    expect(rider.onBike).toBe(true)
    expect(frame()!.speed).toBeGreaterThan(0)
  })

  it('takes a bounce on a trampoline as standing, so a ride from there starts', () => {
    const { rider, her, frame } = setup()
    rider.rideTo(farm, her)
    her.grounded = false
    her.event = 'bounce'
    frame()
    expect(rider.onBike).toBe(true)
  })

  it('stops at once on any of her own keys, and lets her walk from the next frame', () => {
    const presses: Partial<Intents>[] = [
      { moveX: 1 }, { moveZ: -0.5 }, { jump: true }, { turn: -1 }, { turnAround: true }, { lookHome: true },
    ]
    for (const press of presses) {
      const { rider, her, frame, onEnd } = setup()
      rider.rideTo(farm, her)
      for (let i = 0; i < 60; i++) frame()
      const c = frame({ ...none, ...press })!
      expect(onEnd.mock.calls, JSON.stringify(press)).toEqual([['stopped']])
      // This frame is still hers: no move and no jump
      expect([c.moveX, c.moveZ, c.speed, c.jump]).toEqual([0, 0, 0, false])
      expect(rider.onBike).toBe(false)
      expect(frame({ ...none, ...press })).toBeNull()
    }
  })

  it('gives up as stopped when she is stuck against something for a second and a half', () => {
    const { rider, her, frame, onEnd } = setup()
    rider.rideTo(farm, her)
    for (let i = 0; i < 30; i++) frame()
    let frames = 0
    while (!onEnd.mock.calls.length && frames < 600) {
      frame(none, DT, true)
      frames++
    }
    expect(onEnd.mock.calls).toEqual([['stopped']])
    expect(frames / 60).toBeGreaterThan(1.4)
    expect(frames / 60).toBeLessThan(1.7)
  })

  it('never takes a long frame (a tab coming back) as more than a tenth of a second', () => {
    const { rider, her, frame } = setup()
    rider.rideTo(farm, her)
    frame()
    expect(frame(none, 3)!.speed).toBeLessThanOrEqual(8 * (DT + 0.1) + 1e-9)
  })

  it('after a tumble mid-ride, waits for her to stand and rides on from where she landed', () => {
    const { rider, her, frame, onEnd } = setup()
    rider.rideTo(farm, her)
    for (let i = 0; i < 120; i++) frame()
    her.tumbling = true
    expect(frame()!.speed).toBe(0)
    expect(rider.onBike).toBe(false)
    her.tumbling = false
    her.x += 3
    for (let i = 0; i < 60 * 60 && !onEnd.mock.calls.length; i++) frame()
    expect(onEnd.mock.calls).toEqual([['arrived']])
    expect(Math.hypot(her.x - farm.x, her.z - farm.z)).toBeLessThan(0.5)
  })

  it('is cancelled without a word, and a new ride replaces the old one', () => {
    const { rider, her, frame, onEnd } = setup()
    rider.rideTo(farm, her)
    for (let i = 0; i < 60; i++) frame()
    rider.cancel()
    expect(rider.onBike).toBe(false)
    expect(frame()).toBeNull()
    rider.rideTo(farm, her)
    for (let i = 0; i < 60; i++) frame()
    const school = BUILDINGS[0].door
    rider.rideTo({ x: school.x, z: school.z, face: 0 }, her)
    for (let i = 0; i < 60 * 60 && !onEnd.mock.calls.length; i++) frame()
    expect(onEnd.mock.calls).toEqual([['arrived']])
    expect(Math.hypot(her.x - school.x, her.z - school.z)).toBeLessThan(0.5)
  })
})
