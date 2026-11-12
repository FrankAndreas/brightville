import { describe, expect, it } from 'vitest'
import { TURN_SPEED, createView, walkDirection } from './view'

const none = { turn: 0, turnAround: false, lookHome: false }
const near = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.02

describe('walkDirection', () => {
  it('is the keys as they are when looking at the learning row', () => {
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
  it('starts looking at the learning row', () => {
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

  it('looks back at the learning row the short way', () => {
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
})
