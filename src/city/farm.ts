import * as THREE from 'three'
import { playMoo } from '@/services/sound'
import type { Footprint } from './doors'
import { CLEARING, PENS } from './districts/nature'
import type { Part } from './houseKit'
import { heightAt } from './map'
import { mergeParts } from './merge'
import { turnToward } from './walkers'

/**
 * Life on the farm and in the forest: cows and sheep in the pens, chickens that run from her, a cow that moos when
 * she comes close, and deer at the clearing that walk into the trees when she comes near. Where each is is worked out
 * a step at a time from her, so it is tested without drawing.
 */

type Point = { x: number; z: number }

export interface PenAnimal {
  kind: 'cow' | 'chicken' | 'sheep'
  x: number
  z: number
  /** The way it faces (atan2 of x and z, as the characters') */
  heading: number
  homeX: number
  homeZ: number
  /** Chickens: seconds she has been 5 m or more away */
  t: number
  /** When it last mooed, in seconds of the game's time */
  mooAt?: number
}

/** A chicken runs when she is closer than this, gets this far from home at most, and comes back when she is gone */
const CHICKEN_SCARED = 3
const CHICKEN_CALM = 5
const CHICKEN_CALM_TIME = 2
const CHICKEN_RANGE = 2
const CHICKEN_RUN = 4
const CHICKEN_WALK = 1.5
/** The pen's fence is walkable, so the animals keep this far inside it */
const FENCE_MARGIN = 0.4
const COW_LOOKS = 6
const MOO_EVERY = 8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** One step of a cow, sheep or chicken in its pen */
export function stepPenAnimal(a: PenAnimal, her: Point, dt: number, pen: Footprint): PenAnimal {
  const dx = a.x - her.x
  const dz = a.z - her.z
  const d = Math.hypot(dx, dz)
  if (a.kind === 'cow') {
    if (d >= COW_LOOKS) return a
    const to = Math.atan2(-dx, -dz)
    // Facing her already (near enough): nothing to redraw
    if (Math.abs(Math.atan2(Math.sin(to - a.heading), Math.cos(to - a.heading))) < 1e-3) return a
    return { ...a, heading: turnToward(a.heading, to, dt) }
  }
  if (a.kind === 'sheep') return a
  if (d < CHICKEN_SCARED) {
    // Away from her, no further than 2 m from home, and never through the fence
    const len = d > 1e-6 ? d : 1
    let x = a.x + ((d > 1e-6 ? dx : 1) / len) * CHICKEN_RUN * dt
    let z = a.z + ((d > 1e-6 ? dz : 0) / len) * CHICKEN_RUN * dt
    const hx = x - a.homeX
    const hz = z - a.homeZ
    const h = Math.hypot(hx, hz)
    if (h > CHICKEN_RANGE) {
      x = a.homeX + (hx / h) * CHICKEN_RANGE
      z = a.homeZ + (hz / h) * CHICKEN_RANGE
    }
    x = clamp(x, pen.minX + FENCE_MARGIN, pen.maxX - FENCE_MARGIN)
    z = clamp(z, pen.minZ + FENCE_MARGIN, pen.maxZ - FENCE_MARGIN)
    return { ...a, x, z, t: 0, heading: Math.atan2(dx, dz) }
  }
  if (d < CHICKEN_CALM) return a.t === 0 ? a : { ...a, t: 0 }
  const t = a.t + dt
  const gx = a.homeX - a.x
  const gz = a.homeZ - a.z
  const g = Math.hypot(gx, gz)
  // Home and calm: nothing changes (and no new object each frame)
  if (g === 0 && a.t >= CHICKEN_CALM_TIME) return a
  if (t < CHICKEN_CALM_TIME || g === 0) return { ...a, t }
  const step = CHICKEN_WALK * dt
  if (g <= step) return { ...a, t, x: a.homeX, z: a.homeZ }
  return { ...a, t, x: a.x + (gx / g) * step, z: a.z + (gz / g) * step, heading: Math.atan2(gx, gz) }
}

/** A cow moos when she is within 6 m and it hasn't mooed in the last 8 s */
export function wantsMoo(a: PenAnimal, her: Point, now: number): boolean {
  return a.kind === 'cow' && Math.hypot(a.x - her.x, a.z - her.z) < COW_LOOKS && now - (a.mooAt ?? -Infinity) >= MOO_EVERY
}

export interface Deer {
  x: number
  z: number
  heading: number
  state: 'graze' | 'leave' | 'gone'
  /** `leave`: seconds walking; `gone`: seconds she has been 15 m or more away */
  t: number
}

/** Where the deer graze: at the clearing's edge on the side away from the forest's stop and path, 6 m apart */
export const DEER_HOMES: Point[] = [
  { x: CLEARING.x - 3.5, z: CLEARING.z + 3 },
  { x: CLEARING.x - 3.5, z: CLEARING.z - 3 },
]

const DEER_SCARED = 8
/** Gone while she is within 12 m; back once she has been 15 m or more away for 5 s */
const DEER_FAR = 15
const DEER_RETURN_TIME = 5
const DEER_SPEED = 2
/** They walk this far from the clearing's middle into the trees, then are gone (the homes are 6 m apart, and they go different ways) */
const DEER_WALK = 3.5

export function startDeer(): Deer[] {
  return DEER_HOMES.map((h, i) => ({ x: h.x, z: h.z, heading: i ? Math.PI / 2 : -Math.PI / 2, state: 'graze', t: 0 }))
}

const homeOf = (d: Point): Point =>
  DEER_HOMES.reduce((best, h) => (Math.hypot(h.x - d.x, h.z - d.z) < Math.hypot(best.x - d.x, best.z - d.z) ? h : best))

/** One step of a deer: grazing; away from her into the trees when she comes within 8 m; gone; back when she is far */
export function stepDeer(d: Deer, her: Point, dt: number): Deer {
  if (d.state === 'gone') {
    const home = homeOf(d)
    const far = Math.hypot(home.x - her.x, home.z - her.z) >= DEER_FAR
    const t = far ? d.t + dt : 0
    if (t >= DEER_RETURN_TIME) return { ...d, x: home.x, z: home.z, state: 'graze', t: 0 }
    return t === d.t ? d : { ...d, t }
  }
  const dx = d.x - her.x
  const dz = d.z - her.z
  const d2 = Math.hypot(dx, dz)
  if (d.state === 'graze') {
    if (d2 >= DEER_SCARED) return d
    return stepDeer({ ...d, state: 'leave', t: 0 }, her, dt)
  }
  const home = homeOf(d)
  // Out from the clearing's middle, into the trees: the clearing is open, so never just away from her
  const cx = home.x - CLEARING.x
  const cz = home.z - CLEARING.z
  const cl = Math.hypot(cx, cz)
  const ux = cx / cl
  const uz = cz / cl
  const x = d.x + ux * DEER_SPEED * dt
  const z = d.z + uz * DEER_SPEED * dt
  const state = Math.hypot(x - home.x, z - home.z) >= DEER_WALK ? 'gone' : 'leave'
  return { x, z, heading: Math.atan2(ux, uz), state, t: state === 'gone' ? 0 : d.t + dt }
}

/** The pens' stock: two cows in the first pen, three sheep and four chickens in the second */
export function startPenAnimals(): { a: PenAnimal; pen: Footprint }[] {
  const at = (kind: PenAnimal['kind'], pen: Footprint, x: number, z: number, heading: number) =>
    ({ a: { kind, x, z, heading, homeX: x, homeZ: z, t: 0 } as PenAnimal, pen })
  const [cows, yard] = PENS
  return [
    at('cow', cows, 8.5, -99, 0.6), at('cow', cows, 11.5, -97, -0.4),
    at('sheep', yard, 18, -100, 1), at('sheep', yard, 22, -99.5, -1), at('sheep', yard, 21.5, -95.5, 2.5),
    at('chicken', yard, 19, -97.5, 0), at('chicken', yard, 20.5, -98.5, 1), at('chicken', yard, 19.5, -96, 3), at('chicken', yard, 21, -97, -2),
  ]
}

// The block animals (as in animals.ts), facing +z
const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: number): Part =>
  ({ kind: 'walls', x, y, z, w, h, d, color })
const legs = (x: number, z: number, h: number, w: number, color: number) =>
  [[-x, z], [x, z], [-x, -z], [x, -z]].map(([lx, lz]) => box(lx, h / 2, lz, w, h, w, color))
export const FARM_SHAPES = {
  // 8 boxes
  cow: [
    box(0, 0.85, 0, 0.8, 0.7, 1.5, 0xf5f2ea), box(0.41, 0.95, 0.1, 0.02, 0.35, 0.4, 0x2b2b2b),
    box(0, 1.1, 0.95, 0.5, 0.5, 0.5, 0xf5f2ea), box(0, 0.98, 1.22, 0.36, 0.22, 0.12, 0xe8a0a8),
    ...legs(0.28, 0.55, 0.5, 0.18, 0xf5f2ea),
  ],
  // 4 boxes
  chicken: [box(0, 0.25, 0, 0.26, 0.26, 0.36, 0xf7f3e8), box(0, 0.45, 0.2, 0.14, 0.18, 0.14, 0xf7f3e8), box(0, 0.44, 0.3, 0.05, 0.05, 0.08, 0xffa51f), box(0, 0.57, 0.2, 0.04, 0.07, 0.1, 0xd62828)],
  // 6 boxes
  sheep: [box(0, 0.65, 0, 0.8, 0.6, 1, 0xf1eee4), box(0, 0.8, 0.6, 0.32, 0.34, 0.34, 0x3a3532), ...legs(0.24, 0.35, 0.35, 0.12, 0x3a3532)],
  // 7 boxes
  deer: [box(0, 0.95, 0, 0.45, 0.5, 1, 0xa86f3c), box(0, 1.4, 0.5, 0.2, 0.55, 0.22, 0xa86f3c), box(0, 1.75, 0.62, 0.22, 0.24, 0.34, 0xa86f3c), ...legs(0.15, 0.38, 0.7, 0.1, 0x7a4e29)],
}

export interface FarmLife {
  update(time: number, dt: number, her: Point): void
}

/** The farm's and the forest's animals in the scene: each kind one merged shape, drawn instanced (one draw call) */
export function createFarmLife(scene: THREE.Scene): FarmLife {
  const place = new THREE.Object3D()
  const make = (parts: Part[], n: number) => {
    const model = mergeParts(parts.map(p => ({ ...p, at: new THREE.Matrix4() })), Infinity)[0]
    const mesh = new THREE.InstancedMesh(model.geometry, model.material, n)
    mesh.castShadow = false
    // The instances move about the pens: the shape's own bounds are no use for culling
    mesh.frustumCulled = false
    scene.add(mesh)
    return mesh
  }
  const put = (mesh: THREE.InstancedMesh, i: number, x: number, z: number, heading: number, scale = 1) => {
    place.position.set(x, heightAt(x, z), z)
    place.rotation.y = heading
    place.scale.setScalar(scale)
    place.updateMatrix()
    mesh.setMatrixAt(i, place.matrix)
    mesh.instanceMatrix.needsUpdate = true
  }
  const stock = startPenAnimals()
  const pens = stock.map(s => s.pen)
  const animals = stock.map(s => s.a)
  const deer = startDeer()
  const meshes = {
    cow: make(FARM_SHAPES.cow, animals.filter(a => a.kind === 'cow').length),
    sheep: make(FARM_SHAPES.sheep, animals.filter(a => a.kind === 'sheep').length),
    chicken: make(FARM_SHAPES.chicken, animals.filter(a => a.kind === 'chicken').length),
  }
  const deerMesh = make(FARM_SHAPES.deer, deer.length)
  // Each animal's mesh and place in it, worked out once
  const counts = { cow: 0, sheep: 0, chicken: 0 }
  const penMesh = animals.map(a => meshes[a.kind])
  const penSlot = animals.map(a => counts[a.kind]++)
  for (let i = 0; i < animals.length; i++) put(penMesh[i], penSlot[i], animals[i].x, animals[i].z, animals[i].heading)
  for (let i = 0; i < deer.length; i++) put(deerMesh, i, deer[i].x, deer[i].z, deer[i].heading)
  return {
    update(time, dt, her) {
      // Only what moved is put in its mesh again, and only that mesh goes to the graphics card again
      for (let i = 0; i < animals.length; i++) {
        const before = animals[i]
        let a = stepPenAnimal(before, her, dt, pens[i])
        if (wantsMoo(a, her, time)) {
          a = { ...a, mooAt: time }
          playMoo()
        }
        animals[i] = a
        if (a.x !== before.x || a.z !== before.z || a.heading !== before.heading) put(penMesh[i], penSlot[i], a.x, a.z, a.heading)
      }
      for (let i = 0; i < deer.length; i++) {
        const before = deer[i]
        const d = stepDeer(before, her, dt)
        deer[i] = d
        if (d.x !== before.x || d.z !== before.z || d.heading !== before.heading || d.state !== before.state) {
          put(deerMesh, i, d.x, d.z, d.heading, d.state === 'gone' ? 0.0001 : 1)
        }
      }
    },
  }
}
