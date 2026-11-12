import { describe, expect, it } from 'vitest'
import { stepSpring, type Spring } from './spring'
import { WALK_SPEED, JUMP_SPEED, desiredVelocity } from './movement'
import { TUMBLE_MS, shouldTumble } from './tumble'
import { DOOR_RADIUS, nearestDoor, type DoorDef } from './doors'
import { MAX_FRAME_S, clampFrame } from './frame'

describe('stepSpring', () => {
  const run = (damping: number, steps: number) => {
    let s: Spring = { value: 0, velocity: 0 }
    let max = 0
    for (let i = 0; i < steps; i++) {
      s = stepSpring(s, 1, 120, damping, 1 / 60)
      max = Math.max(max, s.value)
    }
    return { s, max }
  }

  it('settles on the target', () => {
    expect(Math.abs(run(12, 300).s.value - 1)).toBeLessThan(0.01)
  })

  it('overshoots first with low damping', () => {
    expect(run(4, 300).max).toBeGreaterThan(1.1)
  })

  it('changes nothing for dt 0', () => {
    expect(stepSpring({ value: 0.3, velocity: 2 }, 1, 120, 12, 0)).toEqual({ value: 0.3, velocity: 2 })
  })
})

describe('desiredVelocity', () => {
  it('walks at WALK_SPEED along one axis', () => {
    expect(WALK_SPEED).toBe(4)
    expect(JUMP_SPEED).toBe(5)
    expect(desiredVelocity({ moveX: 1, moveZ: 0 })).toEqual({ x: 4, z: 0 })
    expect(desiredVelocity({ moveX: 0, moveZ: -1 })).toEqual({ x: 0, z: -4 })
  })

  it('is no faster diagonally', () => {
    const v = desiredVelocity({ moveX: 1, moveZ: 1 })
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(WALK_SPEED)
  })

  it('stands still without input', () => {
    expect(desiredVelocity({ moveX: 0, moveZ: 0 })).toEqual({ x: 0, z: 0 })
  })
})

describe('shouldTumble', () => {
  it('lasts 1500 ms', () => expect(TUMBLE_MS).toBe(1500))
  it.each([
    [6.1, 0, true], [5.9, 0, false], [0, 2.6, true], [0, 2.4, false], [0, 0, false],
  ])('impact %s m/s, fall %s m → %s', (impact, fall, expected) => {
    expect(shouldTumble(impact, fall)).toBe(expected)
  })
})

describe('nearestDoor', () => {
  const a: DoorDef = { id: 'a', x: 0, z: 0, open: true }
  const b: DoorDef = { id: 'b', x: 3, z: 0, open: false }

  it('is null when none is within reach', () => {
    expect(DOOR_RADIUS).toBe(2.5)
    expect(nearestDoor({ x: 10, z: 10 }, [a, b])).toBeNull()
    expect(nearestDoor({ x: 0, z: 0 }, [])).toBeNull()
  })

  it('picks the nearer of two', () => {
    expect(nearestDoor({ x: 1, z: 0 }, [a, b])?.id).toBe('a')
    expect(nearestDoor({ x: 2, z: 0 }, [a, b])?.id).toBe('b')
  })

  it('returns a closed door too', () => {
    expect(nearestDoor({ x: 4, z: 0 }, [a, b])).toBe(b)
  })
})

describe('clampFrame', () => {
  it('caps long frames and rejects nonsense', () => {
    expect(MAX_FRAME_S).toBe(0.05)
    expect(clampFrame(1)).toBe(0.05)
    expect(clampFrame(-1)).toBe(0)
    expect(clampFrame(NaN)).toBe(0)
    expect(clampFrame(0.016)).toBe(0.016)
  })
})
