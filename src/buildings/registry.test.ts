import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { BUILDINGS, canServe, toDoors } from './registry'
import type { BuildingDef } from './types'

const component = defineComponent({ render: () => null })
const yoga: BuildingDef = { id: 'yoga', spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: 0, z: -14 }, component }
const write: BuildingDef = { id: 'write', spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: 5, z: 5 }, component }
const open: BuildingDef = { id: 'open', spokenName: 'Offen', icon: '🚪', kind: 'earn', needs: [], door: { x: 1, z: 1 }, component }
const play: BuildingDef = { id: 'play', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: 9, z: 9 }, component }

describe('building registry', () => {
  it('serves a building only when every need is met', () => {
    expect(canServe(yoga, { camera: true, touch: false, keyboard: true })).toBe(true)
    expect(canServe(yoga, { camera: false, touch: true, keyboard: true })).toBe(false)
    expect(canServe(write, { camera: true, touch: false, keyboard: true })).toBe(false)
    expect(canServe(open, { camera: false, touch: false, keyboard: false })).toBe(true)
    const both: BuildingDef = { ...yoga, needs: ['camera', 'touch'] }
    expect(canServe(both, { camera: true, touch: false, keyboard: true })).toBe(false)
  })

  it('turns buildings into doors, closed when the device cannot serve them', () => {
    expect(toDoors([yoga, write], { camera: false, touch: true, keyboard: false }, false, 0)).toEqual([
      { id: 'yoga', x: 0, z: -14, open: false, locked: false, icon: '🧘' },
      { id: 'write', x: 5, z: 5, open: true, locked: false, icon: '✏️' },
    ])
  })

  it('shows a play door locked before the goal, closed without stars, open with both', () => {
    const device = { camera: true, touch: false, keyboard: true }
    const door = (goal: boolean, stars: number) => toDoors([play], device, goal, stars)[0]
    expect(door(false, 10)).toMatchObject({ open: false, locked: true })
    expect(door(true, 2)).toMatchObject({ open: false, locked: false })
    expect(door(true, 3)).toMatchObject({ open: true, locked: false })
  })

  it('lists the yoga studio and needs a camera', () => {
    const studio = BUILDINGS.find(b => b.id === 'yoga')
    expect(studio).toMatchObject({ spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: 0, z: -14 } })
    expect(studio?.component).toBeTruthy()
  })

  it('lists the school, which needs nothing special', () => {
    const school = BUILDINGS.find(b => b.id === 'school')
    expect(school).toMatchObject({ spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -11, z: -14 } })
  })

  it('keeps the door buildings from overlapping', () => {
    const xs = BUILDINGS.map(b => b.door.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(9)
  })

  it('has unique ids', () => {
    expect(new Set(BUILDINGS.map(b => b.id)).size).toBe(BUILDINGS.length)
  })
})
