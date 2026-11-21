import sharedBuildings from '../../shared/buildings.json'
import { EMPTY_LOTS, SCENERY_HOUSES } from '@/city/map'
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
    expect(studio).toMatchObject({ spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'] })
    expect(studio?.component).toBeTruthy()
  })

  it('lists the school, which needs nothing special', () => {
    const school = BUILDINGS.find(b => b.id === 'school')
    expect(school).toMatchObject({ spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [] })
  })

  it('lists the arcade as a play building that costs 3 stars', () => {
    const arcade = BUILDINGS.find(b => b.id === 'arcade')
    expect(arcade).toMatchObject({ spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [] })
    expect(BUILDINGS.filter(b => b.kind === 'play').every(b => (b.cost ?? 0) > 0)).toBe(true)
  })

  it('lists Ausmalen and Malen as free buildings that need nothing', () => {
    for (const [id, spokenName, icon] of [['ausmalen', 'Ausmalen', '🎨'], ['malen', 'Malen', '🖌️']]) {
      const b = BUILDINGS.find(x => x.id === id)
      expect(b).toMatchObject({ spokenName, icon, kind: 'free', needs: [] })
      expect(b?.preload).toBeTypeOf('function')
    }
  })

  it('lists Unterschiede as an earning building that needs nothing', () => {
    const b = BUILDINGS.find(x => x.id === 'unterschiede')
    expect(b).toMatchObject({ spokenName: 'Unterschiede', icon: '🔍', kind: 'earn', needs: [] })
    expect(b?.preload).toBeTypeOf('function')
  })

  it('lists the Bibliothek and the Farblabor as earning buildings that need nothing', () => {
    expect(BUILDINGS.find(x => x.id === 'bibliothek')).toMatchObject({
      spokenName: 'Bibliothek', icon: '📚', kind: 'earn', needs: [],
    })
    expect(BUILDINGS.find(x => x.id === 'farblabor')).toMatchObject({
      spokenName: 'Farblabor', icon: '🧪', kind: 'earn', needs: [],
    })
  })

  it('lists Schlange and Bonbonjagd as play buildings for 3 Stars that need nothing', () => {
    for (const [id, spokenName, icon] of [['schlange', 'Schlange', '🐍'], ['bonbonjagd', 'Bonbonjagd', '🍬']]) {
      const b = BUILDINGS.find(x => x.id === id)
      expect(b).toMatchObject({ spokenName, icon, kind: 'play', cost: 3, needs: [] })
      expect(b?.preload).toBeTypeOf('function')
    }
  })

  it('lists the Cinema as a play building for 3 Stars, open only when there are films', () => {
    const kino = BUILDINGS.find(x => x.id === 'kino')
    expect(kino).toMatchObject({ spokenName: 'Kino', icon: '🎬', kind: 'play', cost: 3, needs: ['films'] })
    const device = { camera: false, touch: false, keyboard: true }
    expect(canServe(kino!, device)).toBe(false)
    expect(canServe(kino!, { ...device, films: false })).toBe(false)
    expect(canServe(kino!, { ...device, films: true })).toBe(true)
  })

  it('lists the Kleiderladen', () => {
    const laden = BUILDINGS.find(b => b.id === 'laden')
    expect(laden).toMatchObject({ spokenName: 'Kleiderladen', icon: '👗', kind: 'shop', needs: [] })
    expect(laden?.preload).toBeTypeOf('function')
  })

  it('lists the Möbelhaus as the second shop, needing nothing', () => {
    expect(BUILDINGS.filter(b => b.kind === 'shop').map(b => b.id)).toEqual(['laden', 'moebel'])
    const moebel = BUILDINGS.find(b => b.id === 'moebel')
    expect(moebel).toMatchObject({ spokenName: 'Möbelhaus', icon: '🛋️', kind: 'shop', needs: [] })
    expect(moebel?.preload).toBeTypeOf('function')
  })

  it('lists the Flatterflug as a play building for 3 Stars that needs nothing', () => {
    const b = BUILDINGS.find(x => x.id === 'flatterflug')
    expect(b).toMatchObject({ spokenName: 'Flatterflug', icon: '🪽', kind: 'play', cost: 3, needs: [] })
    expect(b?.preload).toBeTypeOf('function')
  })

  it('lists the Reimhaus as an earning building that needs nothing, on the lot by the Tanzsaal', () => {
    const b = BUILDINGS.find(x => x.id === 'reimhaus')
    expect(b).toMatchObject({ spokenName: 'Reimhaus', icon: '👂', kind: 'earn', needs: [], door: { x: 35.5, z: -16, side: 'right' } })
    expect(b?.preload).toBeTypeOf('function')
    const shared = (sharedBuildings as { id: string; maxStars?: number; minSecondsPerStar?: number }[]).find(x => x.id === 'reimhaus')
    expect(shared).toEqual({ id: 'reimhaus', kind: 'earn', maxStars: 10, minSecondsPerStar: 2 })
  })

  it('lists the Musterwerkstatt as an earning building that needs nothing, on the last free lot', () => {
    const b = BUILDINGS.find(x => x.id === 'muster')
    expect(b).toMatchObject({ spokenName: 'Musterwerkstatt', icon: '🧩', kind: 'earn', needs: [], door: { x: 3.5, z: 51, side: 'right' } })
    expect(b?.preload).toBeTypeOf('function')
    const shared = (sharedBuildings as { id: string }[]).find(x => x.id === 'muster')
    expect(shared).toEqual({ id: 'muster', kind: 'earn', maxStars: 10, minSecondsPerStar: 2 })
    // The old town's two lots left are gardens; the districts' lots come after them
    expect(EMPTY_LOTS.slice(0, 2)).toEqual([{ x: -3.5, z: -40, side: 'left' }, { x: -51, z: 3.5, side: 'front' }])
  })

  it('lists the Kalender as an earning building in the plain house next to the Bibliothek', () => {
    const b = BUILDINGS.find(x => x.id === 'kalender')
    expect(b).toMatchObject({ spokenName: 'Kalender', icon: '🗓️', kind: 'earn', needs: [], door: { x: 3.5, z: -24, side: 'right' } })
    expect(b?.preload).toBeTypeOf('function')
    const shared = (sharedBuildings as { id: string }[]).find(x => x.id === 'kalender')
    expect(shared).toEqual({ id: 'kalender', kind: 'earn', maxStars: 10, minSecondsPerStar: 2 })
    expect(SCENERY_HOUSES.some(h => h.spot.x === 3.5 && h.spot.z === -24)).toBe(false)
  })

  it('lists the Spielwelt as an earning building in the plain house by the playground', () => {
    const b = BUILDINGS.find(x => x.id === 'spielwelt')
    expect(b).toMatchObject({ spokenName: 'Spielwelt', icon: '🚗', kind: 'earn', needs: [], door: { x: -16, z: 35.5, side: 'front' } })
    expect(b?.preload).toBeTypeOf('function')
    const shared = (sharedBuildings as { id: string }[]).find(x => x.id === 'spielwelt')
    expect(shared).toEqual({ id: 'spielwelt', kind: 'earn', maxStars: 10, minSecondsPerStar: 2 })
    expect(SCENERY_HOUSES.some(h => h.spot.x === -16 && h.spot.z === 35.5)).toBe(false)
  })

  it('lists the Trommelhaus as an earning building that needs nothing, in a plain house near the Tanzsaal', () => {
    const b = BUILDINGS.find(x => x.id === 'trommelhaus')
    expect(b).toMatchObject({ spokenName: 'Trommelhaus', icon: '🥁', kind: 'earn', needs: [], door: { x: 24, z: -3.5, side: 'back' } })
    const shared = (sharedBuildings as { id: string }[]).find(x => x.id === 'trommelhaus')
    expect(shared).toEqual({ id: 'trommelhaus', kind: 'earn', maxStars: 10, minSecondsPerStar: 3 })
    expect(SCENERY_HOUSES.some(h => h.spot.x === 24 && h.spot.z === -3.5)).toBe(false)
  })

  it('lists the house, free, needing nothing, and kept out of the logbook', () => {
    const haus = BUILDINGS.find(x => x.id === 'haus')
    expect(haus).toMatchObject({ spokenName: 'Mein Haus', icon: '🏠', kind: 'free', needs: [], unlogged: true })
    expect(BUILDINGS.filter(b => b.unlogged).map(b => b.id)).toEqual(['haus'])
  })

  it('lists the Hüpfhalle and the Tanzsaal as earning buildings that need a camera', () => {
    expect(BUILDINGS.find(x => x.id === 'huepfhalle')).toMatchObject({
      spokenName: 'Hüpfhalle', icon: '🦘', kind: 'earn', needs: ['camera'],
    })
    expect(BUILDINGS.find(x => x.id === 'tanzsaal')).toMatchObject({
      spokenName: 'Tanzsaal', icon: '🪩', kind: 'earn', needs: ['camera'],
    })
  })

  it('lists the writing building, which earns and needs a touch screen', () => {
    const schreiben = BUILDINGS.find(b => b.id === 'schreiben')
    expect(schreiben).toMatchObject({ spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'] })
    expect(schreiben?.preload).toBeTypeOf('function')
    const device = { camera: true, touch: false, keyboard: true }
    expect(canServe(schreiben!, device)).toBe(false)
    expect(canServe(schreiben!, { ...device, touch: true })).toBe(true)
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
