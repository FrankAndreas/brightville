import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { footprint, type Footprint } from '@/city/doors'
import { TRAMPOLINE } from '@/city/props'
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
      { id: 'yoga', x: 0, z: -14, side: 'back', open: false, locked: false, icon: '🧘' },
      { id: 'write', x: 5, z: 5, side: 'back', open: true, locked: false, icon: '✏️' },
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
    expect(studio).toMatchObject({ spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: 5, z: -14 } })
    expect(studio?.component).toBeTruthy()
  })

  it('lists the school, which needs nothing special', () => {
    const school = BUILDINGS.find(b => b.id === 'school')
    expect(school).toMatchObject({ spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -15, z: -14 } })
  })

  it('lists the arcade as a play building on the right side that costs 3 stars', () => {
    const arcade = BUILDINGS.find(b => b.id === 'arcade')
    expect(arcade).toMatchObject({ spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { side: 'right' } })
    expect(BUILDINGS.filter(b => b.kind === 'play').every(b => (b.cost ?? 0) > 0)).toBe(true)
  })

  it('lists Ausmalen and Malen as free buildings on the left side that need nothing', () => {
    for (const [id, spokenName, icon] of [['ausmalen', 'Ausmalen', '🎨'], ['malen', 'Malen', '🖌️']]) {
      const b = BUILDINGS.find(x => x.id === id)
      expect(b).toMatchObject({ spokenName, icon, kind: 'free', needs: [], door: { side: 'left' } })
      expect(b?.preload).toBeTypeOf('function')
    }
  })

  it('lists Unterschiede at the back as an earning building that needs nothing', () => {
    const b = BUILDINGS.find(x => x.id === 'unterschiede')
    expect(b).toMatchObject({ spokenName: 'Unterschiede', icon: '🔍', kind: 'earn', needs: [], door: { x: 15, z: -14 } })
    expect(b?.preload).toBeTypeOf('function')
  })

  it('lists Schlange and Bonbonjagd on the right as play buildings for 3 Stars that need nothing', () => {
    for (const [id, spokenName, icon] of [['schlange', 'Schlange', '🐍'], ['bonbonjagd', 'Bonbonjagd', '🍬']]) {
      const b = BUILDINGS.find(x => x.id === id)
      expect(b).toMatchObject({ spokenName, icon, kind: 'play', cost: 3, needs: [], door: { side: 'right' } })
      expect(b?.preload).toBeTypeOf('function')
    }
  })

  it('puts learning at the back, making on the left and playing on the right', () => {
    for (const b of BUILDINGS) {
      const side = b.door.side ?? 'back'
      expect(side).toBe({ earn: 'back', free: 'left', play: 'right' }[b.kind])
    }
  })

  it('lists the writing building, which earns and needs a touch screen', () => {
    const schreiben = BUILDINGS.find(b => b.id === 'schreiben')
    expect(schreiben).toMatchObject({ spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: -5, z: -14 } })
    expect(schreiben?.preload).toBeTypeOf('function')
    const device = { camera: true, touch: false, keyboard: true }
    expect(canServe(schreiben!, device)).toBe(false)
    expect(canServe(schreiben!, { ...device, touch: true })).toBe(true)
  })

  it('keeps every door building up to the wall of the 40 m square', () => {
    for (const b of BUILDINGS) {
      const f = footprint(b.door)
      expect(Math.max(-f.minX, f.maxX, -f.minZ, f.maxZ), b.id).toBeLessThanOrEqual(20)
    }
  })

  it('keeps the door buildings from overlapping, with room to walk between them', () => {
    const gap = (a: Footprint, b: Footprint) => Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minZ - b.maxZ, b.minZ - a.maxZ)
    for (const a of BUILDINGS) {
      for (const b of BUILDINGS) {
        if (a !== b) expect(gap(footprint(a.door), footprint(b.door)), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('keeps the trampoline well away from every door, so nobody bounces off at a door', () => {
    for (const b of BUILDINGS) {
      const gap = Math.hypot(b.door.x - TRAMPOLINE.x, b.door.z - TRAMPOLINE.z) - TRAMPOLINE.radius
      expect(gap, b.id).toBeGreaterThanOrEqual(4)
    }
  })

  it('leaves room to walk up to every door: 3 m to any other house', () => {
    for (const a of BUILDINGS) {
      for (const b of BUILDINGS) {
        const f = footprint(b.door)
        const dx = Math.max(f.minX - a.door.x, 0, a.door.x - f.maxX)
        const dz = Math.max(f.minZ - a.door.z, 0, a.door.z - f.maxZ)
        if (a !== b) expect(Math.hypot(dx, dz), `${a.id} next to ${b.id}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('has unique ids', () => {
    expect(new Set(BUILDINGS.map(b => b.id)).size).toBe(BUILDINGS.length)
  })
})

describe('the buildings file the server reads', () => {
  it('agrees with the town on what earns and what costs', async () => {
    const shared = (await import('../../shared/buildings.json')).default as { id: string; kind: string; cost?: number; maxStars?: number }[]
    expect(shared.map(b => b.id).sort()).toEqual(BUILDINGS.map(b => b.id).sort())
    for (const b of BUILDINGS) {
      const s = shared.find(x => x.id === b.id)!
      expect(s.kind).toBe(b.kind)
      if (b.kind === 'play') expect(s.cost).toBe(b.cost)
      if (b.kind === 'earn') expect(s.maxStars).toBeGreaterThan(0)
    }
  })
})
