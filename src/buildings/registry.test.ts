import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { BUILDINGS, canServe, toDoors } from './registry'
import type { BuildingDef } from './types'

const component = defineComponent({ render: () => null })
const yoga: BuildingDef = { id: 'yoga', spokenName: 'Yoga', icon: '🧘', needs: ['camera'], door: { x: 0, z: -14 }, component }
const write: BuildingDef = { id: 'write', spokenName: 'Schreiben', icon: '✏️', needs: ['touch'], door: { x: 5, z: 5 }, component }
const open: BuildingDef = { id: 'open', spokenName: 'Offen', icon: '🚪', needs: [], door: { x: 1, z: 1 }, component }

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
    expect(toDoors([yoga, write], { camera: false, touch: true, keyboard: false })).toEqual([
      { id: 'yoga', x: 0, z: -14, open: false, icon: '🧘' },
      { id: 'write', x: 5, z: 5, open: true, icon: '✏️' },
    ])
  })

  it('lists the yoga studio and needs a camera', () => {
    const studio = BUILDINGS.find(b => b.id === 'yoga')
    expect(studio).toMatchObject({ spokenName: 'Yoga', icon: '🧘', needs: ['camera'], door: { x: 0, z: -14 } })
    expect(studio?.component).toBeTruthy()
  })

  it('has unique ids', () => {
    expect(new Set(BUILDINGS.map(b => b.id)).size).toBe(BUILDINGS.length)
  })
})
