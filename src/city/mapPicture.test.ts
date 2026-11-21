import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { BOUNDS, STOPS } from './map'
import { MARKER_SIZE, MIN_PIN_GAP, mapPicture } from './mapPicture'
import { footprint } from './doors'

const all = BUILDINGS.map(b => ({ id: b.id, icon: b.icon, name: b.spokenName, door: b.door, state: 'open' as const }))
const viewBox = (v: string) => {
  const [x, y, w, h] = v.split(' ').map(Number)
  return { minX: x, minZ: y, maxX: x + w, maxZ: y + h }
}

describe('mapPicture', () => {
  it('leaves out the buildings this device can never go into', () => {
    const p = mapPicture(all.map(b => (b.id === 'yoga' ? { ...b, state: 'unavailable' as const } : b)))
    const ids = p.markers.filter(m => m.kind === 'building').map(m => m.id)
    expect(ids).not.toContain('yoga')
    expect(ids).toHaveLength(BUILDINGS.length - 1)
  })

  it('has the four stops, always open', () => {
    const stops = mapPicture(all).markers.filter(m => m.kind === 'stop')
    expect(stops.map(s => s.id).sort()).toEqual(['bauernhof', 'platz', 'wald', 'werkstatt'])
    expect(stops.every(s => s.state === 'stop')).toBe(true)
    expect(stops.map(s => [s.x, s.z])).toEqual(STOPS.map(s => [s.x, s.z]))
  })

  it("puts every building's marker at its door, with its own picture and door state", () => {
    const p = mapPicture(all.map(b => (b.id === 'arcade' ? { ...b, state: 'locked' as const } : b)))
    for (const b of BUILDINGS) {
      const m = p.markers.find(k => k.id === b.id)!
      expect([m.x, m.z, m.icon]).toEqual([b.door.x, b.door.z, b.icon])
    }
    expect(p.markers.find(m => m.id === 'arcade')!.state).toBe('locked')
  })

  it('draws the pictures far enough apart to tap each one, near where they belong, inside the picture', () => {
    const p = mapPicture(all)
    const box = viewBox(p.viewBox)
    for (const [i, a] of p.markers.entries()) {
      expect(Math.hypot(a.pin.x - a.x, a.pin.z - a.z)).toBeLessThan(12)
      expect(a.pin.x).toBeGreaterThanOrEqual(box.minX)
      expect(a.pin.x).toBeLessThanOrEqual(box.maxX)
      expect(a.pin.z).toBeGreaterThanOrEqual(box.minZ)
      expect(a.pin.z).toBeLessThanOrEqual(box.maxZ)
      for (const b of p.markers.slice(i + 1)) {
        expect(Math.hypot(a.pin.x - b.pin.x, a.pin.z - b.pin.z), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(MIN_PIN_GAP - 1e-6)
      }
    }
  })

  it('covers the whole town, with the mountains as a band along the top', () => {
    const p = mapPicture(all)
    const box = viewBox(p.viewBox)
    expect(box.minX).toBeLessThanOrEqual(BOUNDS.minX)
    expect(box.maxX).toBeGreaterThanOrEqual(BOUNDS.maxX)
    expect(box.minZ).toBeLessThanOrEqual(BOUNDS.minZ)
    expect(box.maxZ).toBeGreaterThanOrEqual(BOUNDS.maxZ)
    expect(p.mountains.maxZ).toBeLessThanOrEqual(BOUNDS.minZ)
    expect(p.mountains.minZ).toBeGreaterThanOrEqual(box.minZ)
  })

  it('draws the nature district above the old town (−z is up), each area in its own ground colour', () => {
    const p = mapPicture(all)
    const town = p.districts.find(d => d.id === 'town')!
    const nature = p.districts.find(d => d.id === 'nature')!
    expect(Math.max(...nature.areas.map(a => a.maxZ))).toBeLessThanOrEqual(Math.min(...town.areas.map(a => a.minZ)))
    // The forest green, the farm yellow-brown
    expect(nature.areas.map(a => a.ground)).toEqual([0x8cc56f, 0xd9c78c])
  })

  it('leaves a gap between pictures, so a small finger finds the right one', () => {
    const { markers } = mapPicture(BUILDINGS.map(b => ({ id: b.id, icon: b.icon, name: b.spokenName, door: b.door, state: 'open' as const })))
    for (const a of markers) {
      for (const b of markers) {
        if (a !== b) expect(Math.hypot(a.pin.x - b.pin.x, a.pin.z - b.pin.z), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(MARKER_SIZE + 1.5 - 1e-6)
      }
    }
  })

  it("keeps every building's picture on its own house: at least as far back as its front, and nearer it than any other", () => {
    const { markers } = mapPicture(BUILDINGS.map(b => ({ id: b.id, icon: b.icon, name: b.spokenName, door: b.door, state: 'open' as const })))
    const middle = (id: string) => {
      const f = footprint(BUILDINGS.find(b => b.id === id)!.door)
      return { x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2 }
    }
    for (const m of markers.filter(m => m.kind === 'building')) {
      const door = BUILDINGS.find(b => b.id === m.id)!.door
      const own = middle(m.id)
      const back = { x: own.x - door.x, z: own.z - door.z }
      const length = Math.hypot(back.x, back.z)
      // How far from the door towards the house: the house's front is 1 m back
      expect(((m.pin.x - door.x) * back.x + (m.pin.z - door.z) * back.z) / length, m.id).toBeGreaterThanOrEqual(1 - 1e-6)
      const distance = (p: { x: number; z: number }) => Math.hypot(m.pin.x - p.x, m.pin.z - p.z)
      for (const other of BUILDINGS) if (other.id !== m.id) expect(distance(own), `${m.id} nearer ${other.id}`).toBeLessThan(distance(middle(other.id)))
    }
  })
})
