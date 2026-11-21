import { describe, expect, it, vi } from 'vitest'
import type { WalkGrid } from './walkable'

// Two streets that never meet, and the plaza far from both: nothing joins them
vi.mock('./map', async importOriginal => {
  const map = await importOriginal<typeof import('./map')>()
  const streets = [
    { points: [{ x: -40, z: 0 }, { x: -20, z: 0 }], width: 4 },
    { points: [{ x: 20, z: 0 }, { x: 40, z: 0 }], width: 4 },
  ]
  return {
    ...map,
    ALL_STREETS: streets,
    PLAZA: { x: 0, z: 90, radius: 1 },
    onStreet: (x: number, z: number) => Math.abs(z) <= 2 && ((x >= -40 && x <= -20) || (x >= 20 && x <= 40)),
  }
})

import { planRide } from './ride'

const open: WalkGrid = { step: 0.5, free: () => true, reachable: () => () => true }

describe('a ride to somewhere the streets do not reach', () => {
  it('plans nothing, rather than a ride that ends where the streets give out', () => {
    expect(planRide({ x: -30, z: 0 }, { x: 30, z: 0, face: 0 }, open)).toBeNull()
  })

  it('still plans a ride along the street she is on', () => {
    const path = planRide({ x: -38, z: 0 }, { x: -22, z: 0, face: 0 }, open)
    expect(path).not.toBeNull()
    expect(path![path!.length - 1]).toEqual({ x: -22, z: 0 })
  })
})
