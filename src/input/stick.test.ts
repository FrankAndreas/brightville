import { describe, expect, it } from 'vitest'
import { STICK_DEAD, STICK_RADIUS, stickVector } from './stick'

const o = { x: 200, y: 300 }

describe('stickVector', () => {
  it('is at rest inside the dead zone', () => {
    expect(stickVector(o, o)).toEqual({ x: 0, z: 0 })
    expect(stickVector(o, { x: o.x + STICK_DEAD, y: o.y })).toEqual({ x: 0, z: 0 })
  })

  it('grows from the dead zone to full speed at the radius', () => {
    const half = (STICK_DEAD + STICK_RADIUS) / 2
    expect(stickVector(o, { x: o.x + half, y: o.y }).x).toBeCloseTo(0.5)
    expect(stickVector(o, { x: o.x + STICK_RADIUS, y: o.y }).x).toBeCloseTo(1)
  })

  it('never goes beyond full speed', () => {
    const v = stickVector(o, { x: o.x - 900, y: o.y })
    expect(v.x).toBeCloseTo(-1)
    expect(v.z).toBeCloseTo(0)
  })

  it('walks away from the camera when the finger goes up the screen', () => {
    expect(stickVector(o, { x: o.x, y: o.y - 500 }).z).toBeCloseTo(-1)
    expect(stickVector(o, { x: o.x, y: o.y + 500 }).z).toBeCloseTo(1)
  })

  it('keeps the direction on a diagonal', () => {
    const v = stickVector(o, { x: o.x + 300, y: o.y + 300 })
    expect(v.x).toBeCloseTo(Math.SQRT1_2)
    expect(v.z).toBeCloseTo(Math.SQRT1_2)
  })
})
