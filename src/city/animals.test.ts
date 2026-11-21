import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { DOOR_RADIUS, footprint } from './doors'
import { EMPTY_LOTS, JETTY, LAKE, hedgeDistance, inLake, solidAreas } from './map'
import { NATURE_SEED, SOLID_KINDS, placeNature } from './nature'
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

  it('never puts a duck inside a boat', () => {
    for (let t = 0; t < 3600; t += 0.25) {
      for (const d of ducks(t)) {
        for (const b of boats(t)) expect(Math.hypot(d.x - b.x, d.z - b.z), `at ${t}`).toBeGreaterThan(1.6)
      }
    }
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

  it('flies a bird away when she comes within 3 m, never towards her or through a house', () => {
    const ok = spotForBird(doors)
    const solids = solidAreas(doors)
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
        // Over the houses' roofs only in thought: it flies round them, never through one
        expect(solids.some(f => bird.x > f.minX && bird.x < f.maxX && bird.z > f.minZ && bird.z < f.maxZ), `${bird.x},${bird.z}`).toBe(false)
      }
      expect(flew).toBe(true)
      expect(before).toBeGreaterThan(5)
      // Down again, somewhere a bird may be
      for (let t = 0; t < 4; t += 1 / 30) bird = stepBird(bird, { x: 999, z: 999 }, 1 / 30, ok)
      expect(bird.state).toBe('hop')
      expect(ok(bird.homeX, bird.homeZ)).toBe(true)
    }
  })

  it('lets a bird with nowhere to fly flutter up and down on its spot, never towards her', () => {
    const [start] = startBirds(doors)
    const her = { x: start.x + 1, z: start.z + 1 }
    let bird: Bird = start
    let before = Math.hypot(bird.x - her.x, bird.z - her.z)
    let flew = false
    for (let t = 0; t < 1; t += 1 / 30) {
      bird = stepBird(bird, her, 1 / 30, () => false)
      if (bird.state === 'fly') flew = true
      const now = Math.hypot(bird.x - her.x, bird.z - her.z)
      expect(now).toBeGreaterThanOrEqual(before - 1e-6)
      before = now
    }
    expect(flew).toBe(true)
  })

  it('keeps birds off trees, lamps and benches', () => {
    const ok = spotForBird(doors)
    for (const i of placeNature(NATURE_SEED, doors).filter(i => SOLID_KINDS.has(i.kind))) {
      expect(ok(i.x, i.z), `${i.kind} at ${i.x},${i.z}`).toBe(false)
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

  it(`keeps every animal ${DOOR_RADIUS + 1} m from every door, and birds start out of the lake`, () => {
    for (let t = 0; t < 60; t += 0.5) {
      for (const p of [...ducks(t), ...boats(t), dogAt(t), catAt(t)]) expect(farFromDoors(p), `${p.x},${p.z}`).toBe(true)
    }
    for (const b of startBirds(doors)) {
      expect(farFromDoors(b)).toBe(true)
      expect(inLake(b.x, b.z)).toBe(false)
    }
  })
})

describe('where birds sit', () => {
  it('keeps 3 m from every hedge, also on the seams between the town and the districts', () => {
    const ok = spotForBird(doors)
    let tried = 0
    for (let x = -40; x <= 110; x += 0.5) {
      for (let z = -110; z <= 70; z += 0.5) {
        if (hedgeDistance(x, z) < 3) {
          tried++
          expect(ok(x, z), `${x},${z}`).toBe(false)
        }
      }
    }
    expect(tried).toBeGreaterThan(100)
  })
})

describe('the animals drawn', () => {
  it('draws every animal whole, with all its parts', () => {
    const scene = new THREE.Scene()
    createAnimals(scene, doors)
    const meshes: THREE.Mesh[] = []
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    const corners = new Set(meshes.map(m => m.geometry.attributes.position.count))
    // duck 3 boxes, boat 4, bird 3, cat 5, dog 8, sheep 6, deer 7 (cow 8, chicken 4): 24 corners each
    expect([...corners].sort((a, b) => a - b), JSON.stringify(meshes.map(m => m.geometry.attributes.position.count))).toEqual([3, 4, 5, 6, 7, 8].map(boxes => boxes * 24))
    // Small enough not to need shadows: they would double the draw calls
    expect(meshes.filter(m => m.castShadow)).toEqual([])
  })

  it('puts nothing in the graphics card again in a frame where nothing moves, and what moved in a frame where something did', () => {
    const scene = new THREE.Scene()
    const animals = createAnimals(scene, doors)
    const instanced: THREE.InstancedMesh[] = []
    scene.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) instanced.push(o as THREE.InstancedMesh) })
    expect(instanced.length).toBeGreaterThanOrEqual(4)
    const far = { x: 0, z: 0 }
    // Let the chickens' timers run out first
    for (let i = 0; i < 150; i++) animals.update(i / 30, 1 / 30, far)
    const versions = () => instanced.map(m => m.instanceMatrix.version)
    const before = versions()
    for (let i = 0; i < 10; i++) animals.update(10 + i / 30, 1 / 30, far)
    expect(versions()).toEqual(before)
    // She comes into the chickens' pen: some mesh is sent again
    animals.update(11, 1 / 30, { x: 20, z: -97 })
    expect(versions()).not.toEqual(before)
  })
})
