import { describe, expect, it } from 'vitest'
import { TURN_SPEED, createView, walkDirection } from './view'

const none = { turn: 0, turnAround: false, lookHome: false }
const near = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.02

describe('walkDirection', () => {
  it('is the keys as they are when not turned', () => {
    expect(walkDirection(0, 1, 0)).toEqual({ x: 1, z: 0 })
    expect(walkDirection(0, 0, -1)).toEqual({ x: 0, z: -1 })
  })

  it('always walks away from the camera on "up", however the view is turned', () => {
    for (const yaw of [0.3, Math.PI / 2, Math.PI, -2]) {
      const up = walkDirection(yaw, 0, -1)
      // The camera sits at (sin yaw, cos yaw) behind the character
      expect(up.x).toBeCloseTo(-Math.sin(yaw))
      expect(up.z).toBeCloseTo(-Math.cos(yaw))
      const right = walkDirection(yaw, 1, 0)
      // Right is a quarter turn clockwise from up, seen from above
      expect(right.x).toBeCloseTo(Math.cos(yaw))
      expect(right.z).toBeCloseTo(-Math.sin(yaw))
    }
  })
})

describe('createView', () => {
  it('starts looking along -z', () => {
    expect(createView().yaw).toBe(0)
  })

  it('turns while J or L is held', () => {
    const view = createView()
    view.step({ ...none, turn: 1 }, 0.5)
    expect(view.yaw).toBeCloseTo(-TURN_SPEED * 0.5)
    view.step({ ...none, turn: -1 }, 1)
    expect(view.yaw).toBeCloseTo(TURN_SPEED * 0.5)
    view.step(none, 1)
    expect(view.yaw).toBeCloseTo(TURN_SPEED * 0.5)
  })

  it('turns around smoothly, within a second', () => {
    const view = createView()
    view.step({ ...none, turnAround: true }, 1 / 60)
    expect(near(view.yaw, Math.PI)).toBe(false)
    for (let i = 0; i < 60; i++) view.step(none, 1 / 60)
    expect(near(view.yaw, Math.PI)).toBe(true)
  })

  it('looks home the short way', () => {
    const view = createView()
    view.step({ ...none, turn: -1 }, 1)
    for (let i = 0; i < 4; i++) view.step({ ...none, turnAround: true }, 1)
    view.step({ ...none, lookHome: true }, 1 / 60)
    for (let i = 0; i < 60; i++) view.step(none, 1 / 60)
    expect(near(view.yaw, 0)).toBe(true)
  })

  it('lets a held turn take over from a turn-around', () => {
    const view = createView()
    view.step({ ...none, turnAround: true }, 1 / 60)
    const before = view.yaw
    view.step({ ...none, turn: 1 }, 0.1)
    view.step(none, 1)
    expect(view.yaw).toBeCloseTo(before - TURN_SPEED * 0.1)
  })

  it('looks towards the plaza from anywhere in the town', () => {
    const view = createView()
    view.step({ ...none, lookHome: true }, 1 / 60, { x: 30, z: 0 })
    for (let i = 0; i < 60; i++) view.step(none, 1 / 60, { x: 30, z: 0 })
    expect(near(view.yaw, Math.atan2(30, 0))).toBe(true)
  })

  it('looks the first way on the plaza itself', () => {
    const view = createView()
    view.step({ ...none, turn: 1 }, 1)
    view.step({ ...none, lookHome: true }, 1 / 60, { x: 0, z: 5 })
    for (let i = 0; i < 60; i++) view.step(none, 1 / 60, { x: 0, z: 5 })
    expect(near(view.yaw, 0)).toBe(true)
  })
})

describe('the view on the bicycle', () => {
  it('swings round behind her as she rides, not all at once', () => {
    const view = createView()
    // Riding towards +x (heading π/2): behind her the camera sits towards -x, at yaw -π/2
    view.behind(Math.PI / 2, 1 / 60)
    expect(Math.abs(view.yaw)).toBeGreaterThan(0)
    expect(Math.abs(view.yaw)).toBeLessThan(0.2)
    for (let i = 0; i < 120; i++) view.behind(Math.PI / 2, 1 / 60)
    expect(near(view.yaw, -Math.PI / 2)).toBe(true)
    // Up walks the way she rides
    const up = walkDirection(view.yaw, 0, -1)
    expect(up.x).toBeCloseTo(1, 1)
  })

  it('then turns by hand as before, from where it swung to', () => {
    const view = createView()
    for (let i = 0; i < 120; i++) view.behind(Math.PI, 1 / 60)
    const was = view.yaw
    view.step({ ...none, turn: 1 }, 0.5)
    expect(near(view.yaw, was - TURN_SPEED * 0.5)).toBe(true)
  })
})
