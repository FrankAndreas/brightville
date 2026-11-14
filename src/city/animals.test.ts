import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint } from './doors'
import { EMPTY_LOTS, JETTY, LAKE, inLake } from './map'
import * as THREE from 'three'
import { CAT, DOG_GARDEN, boats, catAt, createAnimals, dogAt, ducks, spotForBird, startBirds, stepBird, type Bird } from './animals'

const doors = BUILDINGS.map(b => b.door)
/** Inside the lake, 2 m or more from its shore */
const deepIn = (p: { x: number; z: number }) => ((p.x - LAKE.x) / (LAKE.rx - 2)) ** 2 + ((p.z - LAKE.z) / (LAKE.rz - 2)) ** 2 <= 1
const offJetty = (p: { x: number; z: number }) =>
  Math.max(JETTY.minX - p.x, p.x - JETTY.maxX, JETTY.minZ - p.z, p.z - JETTY.maxZ) >= 2
const farFromDoors = (p: { x: number; z: number }) => doors.every(d => Math.hypot(d.x - p.x, d.z - p.z) >= DOOR_RADIUS + 1)

describe('animals', () => {
  it('keeps ducks and boats on the water, 2 m from the shore and the jetty', () => {
    for (let t = 0; t < 120; t += 0.25) {
      for (const p of [...ducks(t), ...boats(t)]) {
        expect(deepIn(p), `${p.x.toFixed(1)},${p.z.toFixed(1)} at ${t}`).toBe(true)
        expect(offJetty(p), `${p.x.toFixed(1)},${p.z.toFixed(1)} at ${t}`).toBe(true)
      }
    }
    expect(ducks(0).length).toBeGreaterThanOrEqual(3)
    expect(boats(0).length).toBeGreaterThanOrEqual(2)
  })

  it('moves ducks and boats slowly', () => {
    for (const list of [ducks, boats]) {
      const a = list(10)
      const b = list(11)
      a.forEach((p, i) => {
        const v = Math.hypot(b[i].x - p.x, b[i].z - p.z)
        expect(v).toBeGreaterThan(0.05)
        expect(v).toBeLessThan(1.2)
      })
    }
  })

  it('flies a bird away when she comes within 3 m, never towards her', () => {
    const ok = spotForBird(doors)
    for (const start of startBirds(doors)) {
      const her = { x: start.x + 2, z: start.z + 1 }
      let bird: Bird = start
      let before = Math.hypot(bird.x - her.x, bird.z - her.z)
      let flew = false
      // Until it has landed again, 8 m away (then it hops about its new spot, far from her)
      for (let t = 0; t < 4 && !(flew && bird.state === 'hop'); t += 1 / 30) {
        bird = stepBird(bird, her, 1 / 30, ok)
        const now = Math.hypot(bird.x - her.x, bird.z - her.z)
        expect(now).toBeGreaterThanOrEqual(before - 1e-6)
        before = now
        if (bird.state === 'fly') flew = true
      }
      expect(flew).toBe(true)
      expect(before).toBeGreaterThan(5)
      // Down again, somewhere a bird may be
      for (let t = 0; t < 4; t += 1 / 30) bird = stepBird(bird, { x: 999, z: 999 }, 1 / 30, ok)
      expect(bird.state).toBe('hop')
      expect(ok(bird.homeX, bird.homeZ)).toBe(true)
    }
  })

  it('lets birds hop about where they are while she is away', () => {
    const ok = spotForBird(doors)
    for (const start of startBirds(doors)) {
      let bird: Bird = start
      for (let t = 0; t < 20; t += 1 / 30) {
        bird = stepBird(bird, { x: 999, z: 999 }, 1 / 30, ok)
        expect(Math.hypot(bird.x - start.x, bird.z - start.z)).toBeLessThan(2)
      }
    }
  })

  it('keeps the dog in its garden, and the cat asleep on the garden wall', () => {
    const garden = footprint(EMPTY_LOTS[DOG_GARDEN])
    for (let t = 0; t < 200; t += 0.3) {
      const d = dogAt(t)
      expect(d.x).toBeGreaterThan(garden.minX + 0.4)
      expect(d.x).toBeLessThan(garden.maxX - 0.4)
      expect(d.z).toBeGreaterThan(garden.minZ + 0.4)
      expect(d.z).toBeLessThan(garden.maxZ - 0.4)
    }
    expect(catAt(0).x).toBeCloseTo(CAT.x)
    expect(catAt(1).scale).not.toBeCloseTo(catAt(2.5).scale, 3)
  })

  it(`keeps every animal ${DOOR_RADIUS + 1} m from every door, and birds out of the lake`, () => {
    for (let t = 0; t < 60; t += 0.5) {
      for (const p of [...ducks(t), ...boats(t), dogAt(t), catAt(t)]) expect(farFromDoors(p), `${p.x},${p.z}`).toBe(true)
    }
    for (const b of startBirds(doors)) {
      expect(farFromDoors(b)).toBe(true)
      expect(inLake(b.x, b.z)).toBe(false)
    }
  })
})

describe('the animals drawn', () => {
  it('draws every animal whole, with all its parts', () => {
    const scene = new THREE.Scene()
    createAnimals(scene, doors)
    const meshes: THREE.Mesh[] = []
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    const corners = new Set(meshes.map(m => m.geometry.attributes.position.count))
    // duck 3 boxes, boat 4, bird 3, cat 5, dog 8: 24 corners each
    expect([...corners].sort((a, b) => a - b), JSON.stringify(meshes.map(m => m.geometry.attributes.position.count))).toEqual([3, 4, 5, 8].map(boxes => boxes * 24))
  })
})
