import * as THREE from 'three'
import { DOOR_RADIUS, footprint, type DoorSpot } from './doors'
import type { Part } from './houseKit'
import { EMPTY_LOTS, LAKE, TOWN_HALF, heightAt, inLake, solidAreas } from './map'
import { mergeParts } from './merge'

/**
 * Life in the town that is only to look at: ducks paddling and boats drifting on the lake, birds hopping that fly up
 * when she comes close, a cat asleep on a garden wall and a dog in a garden. Nothing comes towards her. Where each is
 * is worked out from the time (and her, for the birds), so it is tested without drawing.
 */

type Point = { x: number; z: number }
type Facing = Point & { heading: number }

/** Along an ellipse at `speed` metres a second, facing the way it goes */
function loop(cx: number, cz: number, rx: number, rz: number, speed: number, phase: number, t: number): Facing {
  const w = speed / ((rx + rz) / 2)
  const a = phase + t * w
  return { x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz, heading: Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz) }
}

/** A mother duck and two ducklings, one behind the other, in the lake's left part */
export function ducks(t: number): Facing[] {
  return [0, 0.45, 0.85].map(lag => loop(LAKE.x - 4.5, LAKE.z + 1.5, 2, 1.5, 0.3, -lag, t))
}

/** Two little sailing boats, round the right part of the lake, a long way apart */
export function boats(t: number): Facing[] {
  return [0, Math.PI].map(phase => loop(LAKE.x + 1.5, LAKE.z + 2.5, 4, 2.5, 0.45, phase, t))
}

/** The cat sleeps on the back wall of the first garden; the dog plays in the third */
const CAT_GARDEN = 0
export const DOG_GARDEN = 2
const catGarden = footprint(EMPTY_LOTS[CAT_GARDEN])
export const CAT = { x: catGarden.minX, z: (catGarden.minZ + catGarden.maxZ) / 2 }

export function catAt(t: number): Point & { scale: number } {
  return { ...CAT, scale: 1 + 0.04 * Math.sin(t * 1.6) }
}

export function dogAt(t: number): Facing {
  const g = footprint(EMPTY_LOTS[DOG_GARDEN])
  const cx = (g.minX + g.maxX) / 2
  const cz = (g.minZ + g.maxZ) / 2
  const ax = (g.maxX - g.minX) / 2 - 0.8
  const az = (g.maxZ - g.minZ) / 2 - 0.8
  const x = cx + Math.sin(t * 0.5) * ax
  const z = cz + Math.sin(t * 0.83 + 1) * az
  return { x, z, heading: Math.atan2(Math.cos(t * 0.5) * 0.5 * ax, Math.cos(t * 0.83 + 1) * 0.83 * az) }
}

export interface Bird {
  x: number
  z: number
  /** Height above the ground */
  y: number
  state: 'hop' | 'fly'
  homeX: number
  homeZ: number
  /** Time in this state */
  t: number
  fromX: number
  fromZ: number
}

const SCARED = 3
const FLIGHT = 8
const FLIGHT_SPEED = 4

/** Where a bird may sit: on the ground, not in the lake, a house, or near a door */
export function spotForBird(doors: DoorSpot[]): (x: number, z: number) => boolean {
  const solids = solidAreas(doors)
  return (x, z) =>
    Math.max(Math.abs(x), Math.abs(z)) < TOWN_HALF - 3 &&
    !inLake(x, z) && ((x - LAKE.x) / (LAKE.rx + 1.5)) ** 2 + ((z - LAKE.z) / (LAKE.rz + 1.5)) ** 2 > 1 &&
    doors.every(d => Math.hypot(d.x - x, d.z - z) >= DOOR_RADIUS + 2) &&
    !solids.some(f => x >= f.minX - 1 && x <= f.maxX + 1 && z >= f.minZ - 1 && z <= f.maxZ + 1)
}

const BIRD_HOMES: Point[] = [{ x: -20, z: -14 }, { x: -36, z: -42 }, { x: 12, z: -46 }, { x: -46, z: 30 }, { x: 22, z: 44 }]

export function startBirds(doors: DoorSpot[]): Bird[] {
  const ok = spotForBird(doors)
  return BIRD_HOMES.filter(h => ok(h.x, h.z)).map(h => ({ ...h, y: 0, state: 'hop', homeX: h.x, homeZ: h.z, t: 0, fromX: h.x, fromZ: h.z }))
}

/** A step: hopping about its spot; when she comes within 3 m, up and 8 m away from her, and down again */
export function stepBird(b: Bird, her: Point, dt: number, ok: (x: number, z: number) => boolean): Bird {
  const t = b.t + dt
  if (b.state === 'hop') {
    const dx = b.x - her.x
    const dz = b.z - her.z
    const d = Math.hypot(dx, dz)
    if (d < SCARED) {
      // Away from her, or up to 60° off that if a house or the lake is there: always further from her
      const away = Math.atan2(dx, dz)
      for (const turn of [0, 0.5, -0.5, 1, -1]) {
        const a = away + turn
        const tx = b.x + Math.sin(a) * FLIGHT
        const tz = b.z + Math.cos(a) * FLIGHT
        if (ok(tx, tz)) return { ...b, state: 'fly', t: 0, fromX: b.x, fromZ: b.z, homeX: tx, homeZ: tz }
      }
    }
    // A little round its spot, in small hops
    return { ...b, t, x: b.homeX + Math.sin(t * 0.8) * 0.6, z: b.homeZ + (1 - Math.cos(t * 0.8)) * 0.4, y: Math.abs(Math.sin(t * 6)) * 0.12 }
  }
  const k = Math.min(1, (t * FLIGHT_SPEED) / FLIGHT)
  const x = b.fromX + (b.homeX - b.fromX) * k
  const z = b.fromZ + (b.homeZ - b.fromZ) * k
  if (k >= 1) return { ...b, state: 'hop', t: 0, x, z, y: 0 }
  return { ...b, t, x, z, y: Math.sin(Math.PI * k) * 3 }
}

// The block animals, each kind one shape (its boxes merged), facing +z
const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number): Part =>
  ({ kind: 'walls', x, y, z, w, h, d, color })
const SHAPES = {
  duck: [box(0, 0.15, 0, 0.36, 0.22, 0.5, 0xf5f0e1), box(0, 0.36, 0.2, 0.2, 0.2, 0.2, 0x2e7d32), box(0, 0.34, 0.34, 0.1, 0.06, 0.12, 0xff8c1a)],
  boat: [
    box(0, 0.15, 0, 1, 0.3, 2.2, 0xd62828), box(0, 0.31, 0, 0.8, 0.04, 1.9, 0xa0703f),
    box(0, 1.1, 0.2, 0.07, 1.6, 0.07, 0x6b4a2b), box(0, 1.15, -0.25, 0.04, 1.2, 0.8, 0xfffaf0),
  ],
  bird: [box(0, 0.1, 0, 0.14, 0.12, 0.24, 0x4f8fe8), box(0, 0.2, 0.12, 0.11, 0.11, 0.11, 0x4f8fe8), box(0, 0.19, 0.2, 0.04, 0.04, 0.07, 0xffc23d)],
  cat: [
    box(0, 0.12, 0, 0.32, 0.24, 0.6, 0xf4a259), box(0, 0.22, 0.34, 0.26, 0.22, 0.22, 0xf4a259),
    box(-0.08, 0.36, 0.36, 0.06, 0.08, 0.05, 0xf4a259), box(0.08, 0.36, 0.36, 0.06, 0.08, 0.05, 0xf4a259),
    box(0.12, 0.08, -0.3, 0.08, 0.08, 0.3, 0xf4a259),
  ],
  dog: [
    box(0, 0.42, 0, 0.36, 0.32, 0.8, 0x8a5a33), box(0, 0.6, 0.46, 0.3, 0.3, 0.3, 0x8a5a33), box(0, 0.55, 0.65, 0.14, 0.12, 0.12, 0x3b2a1a),
    ...[[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]].map(([x, z]) => box(x, 0.13, z, 0.1, 0.26, 0.1, 0x6b4426)),
    box(0, 0.6, -0.45, 0.06, 0.06, 0.25, 0x8a5a33),
  ],
}

export interface Animals {
  update(time: number, dt: number, her: Point): void
}

/** Puts the animals in the town and moves them each frame */
export function createAnimals(scene: THREE.Scene, doors: DoorSpot[]): Animals {
  // One mesh for the whole animal: one endless cell (a finite one would split the parts either side of 0)
  const shape = (parts: Part[]) => mergeParts(parts.map(p => ({ ...p, at: new THREE.Matrix4() })), Infinity)[0]
  const make = (parts: Part[], n: number) => {
    const model = shape(parts)
    return Array.from({ length: n }, (_, i) => {
      const mesh = i === 0 ? model : new THREE.Mesh(model.geometry, model.material)
      mesh.castShadow = true
      scene.add(mesh)
      return mesh
    })
  }
  const ok = spotForBird(doors)
  let birds = startBirds(doors)
  const duckMeshes = make(SHAPES.duck, ducks(0).length)
  const boatMeshes = make(SHAPES.boat, boats(0).length)
  const birdMeshes = make(SHAPES.bird, birds.length)
  const [cat] = make(SHAPES.cat, 1)
  const [dog] = make(SHAPES.dog, 1)
  const place = (mesh: THREE.Object3D, p: Facing, y: number) => {
    mesh.position.set(p.x, y, p.z)
    mesh.rotation.y = p.heading
  }
  return {
    update(time, dt, her) {
      ducks(time).forEach((p, i) => place(duckMeshes[i], p, 0.02 + Math.sin(time * 2 + i) * 0.02))
      boats(time).forEach((p, i) => {
        place(boatMeshes[i], p, Math.sin(time * 1.3 + i) * 0.05)
        boatMeshes[i].rotation.z = Math.sin(time * 0.9 + i) * 0.05
      })
      birds = birds.map(b => stepBird(b, her, dt, ok))
      birds.forEach((b, i) => {
        const heading = b.state === 'fly' ? Math.atan2(b.homeX - b.fromX, b.homeZ - b.fromZ) : Math.cos(b.t * 0.8) > 0 ? Math.PI / 2 : -Math.PI / 2
        place(birdMeshes[i], { x: b.x, z: b.z, heading }, heightAt(b.x, b.z) + b.y)
      })
      const c = catAt(time)
      cat.position.set(c.x, heightAt(c.x, c.z) + 0.6, c.z)
      cat.rotation.y = Math.PI / 2
      cat.scale.set(1, c.scale, 1)
      place(dog, dogAt(time), heightAt(dogAt(time).x, dogAt(time).z))
    },
  }
}
