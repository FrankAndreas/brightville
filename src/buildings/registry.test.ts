import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { footprint, type Footprint } from '@/city/doors'
import { BLOCKS, TRAMPOLINES } from '@/city/props'
import { HALF_SIZE } from '@/city/world'
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
    expect(studio).toMatchObject({ spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: -5, z: -24 } })
    expect(studio?.component).toBeTruthy()
  })

  it('lists the school, which needs nothing special', () => {
    const school = BUILDINGS.find(b => b.id === 'school')
    expect(school).toMatchObject({ spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -25, z: -24 } })
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
    expect(b).toMatchObject({ spokenName: 'Unterschiede', icon: '🔍', kind: 'earn', needs: [], door: { x: 5, z: -24 } })
    expect(b?.preload).toBeTypeOf('function')
  })

  it('lists the Bibliothek and the Farblabor at the back as earning buildings that need nothing', () => {
    expect(BUILDINGS.find(x => x.id === 'bibliothek')).toMatchObject({
      spokenName: 'Bibliothek', icon: '📚', kind: 'earn', needs: [], door: { x: 15, z: -24 },
    })
    expect(BUILDINGS.find(x => x.id === 'farblabor')).toMatchObject({
      spokenName: 'Farblabor', icon: '🧪', kind: 'earn', needs: [], door: { x: 25, z: -24 },
    })
  })

  it('lists Schlange and Bonbonjagd on the right as play buildings for 3 Stars that need nothing', () => {
    for (const [id, spokenName, icon] of [['schlange', 'Schlange', '🐍'], ['bonbonjagd', 'Bonbonjagd', '🍬']]) {
      const b = BUILDINGS.find(x => x.id === id)
      expect(b).toMatchObject({ spokenName, icon, kind: 'play', cost: 3, needs: [], door: { side: 'right' } })
      expect(b?.preload).toBeTypeOf('function')
    }
  })

  it('lists the Cinema on the right as a play building for 3 Stars, open only when there are films', () => {
    const kino = BUILDINGS.find(x => x.id === 'kino')
    expect(kino).toMatchObject({ spokenName: 'Kino', icon: '🎬', kind: 'play', cost: 3, needs: ['films'], door: { side: 'right' } })
    const device = { camera: false, touch: false, keyboard: true }
    expect(canServe(kino!, device)).toBe(false)
    expect(canServe(kino!, { ...device, films: false })).toBe(false)
    expect(canServe(kino!, { ...device, films: true })).toBe(true)
  })

  it('puts learning at the back, making and moving on the left, playing on the right and the house at the front', () => {
    const MOVING = ['huepfhalle', 'tanzsaal']
    for (const b of BUILDINGS) {
      const side = b.door.side ?? 'back'
      // The right side is full: the Flatterflug plays at the front, by the playground
      const expected = b.id === 'haus' || b.id === 'flatterflug' ? 'front' : MOVING.includes(b.id) ? 'left' : { earn: 'back', free: 'left', play: 'right', shop: 'front' }[b.kind]
      expect(side, b.id).toBe(expected)
    }
  })

  it('lists the Kleiderladen at the front, next to the house', () => {
    const laden = BUILDINGS.find(b => b.id === 'laden')
    expect(laden).toMatchObject({ spokenName: 'Kleiderladen', icon: '👗', kind: 'shop', needs: [], door: { x: -21, z: 24, side: 'front' } })
    expect(laden?.preload).toBeTypeOf('function')
  })

  it('lists the Möbelhaus at the front as the second shop, needing nothing', () => {
    expect(BUILDINGS.filter(b => b.kind === 'shop').map(b => b.id)).toEqual(['laden', 'moebel'])
    const moebel = BUILDINGS.find(b => b.id === 'moebel')
    expect(moebel).toMatchObject({ spokenName: 'Möbelhaus', icon: '🛋️', kind: 'shop', needs: [], door: { side: 'front' } })
    expect(moebel?.preload).toBeTypeOf('function')
  })

  it('lists the Flatterflug at the front as a play building for 3 Stars that needs nothing', () => {
    const b = BUILDINGS.find(x => x.id === 'flatterflug')
    expect(b).toMatchObject({ spokenName: 'Flatterflug', icon: '🪽', kind: 'play', cost: 3, needs: [], door: { side: 'front' } })
    expect(b?.preload).toBeTypeOf('function')
  })

  it('lists the house at the front, free, needing nothing, and kept out of the logbook', () => {
    const haus = BUILDINGS.find(x => x.id === 'haus')
    expect(haus).toMatchObject({ spokenName: 'Mein Haus', icon: '🏠', kind: 'free', needs: [], door: { x: -5, z: 24, side: 'front' }, unlogged: true })
    expect(BUILDINGS.filter(b => b.unlogged).map(b => b.id)).toEqual(['haus'])
  })

  it('lists the Hüpfhalle and the Tanzsaal on the left as earning buildings that need a camera', () => {
    expect(BUILDINGS.find(x => x.id === 'huepfhalle')).toMatchObject({
      spokenName: 'Hüpfhalle', icon: '🦘', kind: 'earn', needs: ['camera'], door: { x: -23, z: 8, side: 'left' },
    })
    expect(BUILDINGS.find(x => x.id === 'tanzsaal')).toMatchObject({
      spokenName: 'Tanzsaal', icon: '🪩', kind: 'earn', needs: ['camera'], door: { x: -23, z: 18, side: 'left' },
    })
  })

  it('lists the writing building, which earns and needs a touch screen', () => {
    const schreiben = BUILDINGS.find(b => b.id === 'schreiben')
    expect(schreiben).toMatchObject({ spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: -15, z: -24 } })
    expect(schreiben?.preload).toBeTypeOf('function')
    const device = { camera: true, touch: false, keyboard: true }
    expect(canServe(schreiben!, device)).toBe(false)
    expect(canServe(schreiben!, { ...device, touch: true })).toBe(true)
  })

  it('keeps every door building up to the wall of the square', () => {
    for (const b of BUILDINGS) {
      const f = footprint(b.door)
      expect(Math.max(-f.minX, f.maxX, -f.minZ, f.maxZ), b.id).toBeLessThanOrEqual(HALF_SIZE)
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

  it('keeps every trampoline well away from every door, so nobody bounces off at a door', () => {
    for (const t of TRAMPOLINES) {
      for (const b of BUILDINGS) {
        const gap = Math.hypot(b.door.x - t.x, b.door.z - t.z) - t.radius
        expect(gap, `${b.id} / trampoline at ${t.x},${t.z}`).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('keeps the playground inside the square, off the houses and clear of the doors', () => {
    const blocks: Footprint[] = BLOCKS.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }))
    const pads: Footprint[] = TRAMPOLINES.map(t => ({ minX: t.x - t.radius, maxX: t.x + t.radius, minZ: t.z - t.radius, maxZ: t.z + t.radius }))
    const gap = (a: Footprint, b: Footprint) => Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minZ - b.maxZ, b.minZ - a.maxZ)
    for (const thing of [...blocks, ...pads]) {
      expect(Math.max(-thing.minX, thing.maxX, -thing.minZ, thing.maxZ)).toBeLessThanOrEqual(HALF_SIZE - 1)
      for (const b of BUILDINGS) {
        expect(gap(thing, footprint(b.door)), b.id).toBeGreaterThanOrEqual(2)
        const ring = { minX: b.door.x, maxX: b.door.x, minZ: b.door.z, maxZ: b.door.z }
        expect(gap(thing, ring), `${b.id} door`).toBeGreaterThanOrEqual(4)
      }
    }
    // Nothing stands on the plaza, where the character starts
    for (const thing of [...blocks, ...pads]) expect(gap(thing, { minX: -2, maxX: 2, minZ: 3, maxZ: 7 })).toBeGreaterThan(1)
    // ...or on top of each other, except the steps that lead up to the platform
    const all = [...blocks.filter((_, i) => BLOCKS[i].kind === 'hurdle'), ...pads]
    for (const a of all) for (const b of all) if (a !== b) expect(gap(a, b)).toBeGreaterThan(1)
  })

  it('keeps the steps and the platform off every path from the plaza to a door', () => {
    // A path runs straight from the middle to a door and is 2.4 m wide (city/world.ts); the hurdles are for hopping
    const solid = BLOCKS.filter(b => b.kind !== 'hurdle')
    for (const b of BUILDINGS) {
      for (const block of solid) {
        let closest = Infinity
        for (let t = 0; t <= 1; t += 0.002) {
          const x = b.door.x * t
          const z = b.door.z * t
          const dx = Math.max(block.x - block.w / 2 - x, 0, x - block.x - block.w / 2)
          const dz = Math.max(block.z - block.d / 2 - z, 0, z - block.z - block.d / 2)
          closest = Math.min(closest, Math.hypot(dx, dz))
        }
        expect(closest, `${block.kind} at ${block.x},${block.z} / path to ${b.id}`).toBeGreaterThanOrEqual(1.2)
      }
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
