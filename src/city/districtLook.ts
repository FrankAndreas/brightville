import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Part } from './houseKit'
import { mergeParts, type PlacedPart } from './merge'
import { UNSEEN_GROUPS } from './groups'
import { ALL_PROPS, heightAt } from './map'
import type { DistrictProp } from './districts/types'
import { FIELD, PENS } from './districts/nature'

type Rapier = typeof RAPIER

/**
 * What stands in the districts besides houses and trees: the farm's tractor and field, the workshop's crates and its
 * crane. Built from boxes like the houses, into the same merged meshes (`parts`); only the crane's arm is a mesh of
 * its own, as it turns. The pens' fences are nature (nature.ts).
 */

const SOIL = 0x8b5e3c
const PASTURE = 0xa9d48a
const CROP = 0x6abf4b
const TRACTOR = 0x2e9e44
const TYRE = 0x333333
const HUB = 0xf2c230
const GLASS = 0x9fd3f0
const STEEL = 0x8a8f96
const CRATE = 0xc08a4a
const SLAT = 0x8a5a2b
const CRANE = 0xf2b705
const CONCRETE = 0xb0aca4
/** The crane's arm turns this fast (radians a second): once round in under a minute */
const CRANE_TURN = 0.12
const CRANE_HEIGHT = 12

const part = (x: number, y: number, z: number, w: number, h: number, d: number, color: number, rotY = 0): Part =>
  ({ kind: 'trim', x, y, z, w, h, d, color, rotY })

/** The tractor, facing −z (towards the lane), its big wheels at the back */
function tractor(): Part[] {
  return [
    part(0, 0.9, -0.2, 1.2, 0.8, 2.4, TRACTOR),
    part(0, 1.85, 0.6, 1.2, 0.9, 1.0, GLASS),
    part(0, 2.35, 0.6, 1.4, 0.1, 1.2, TRACTOR),
    part(0.4, 1.6, -0.9, 0.12, 0.7, 0.12, STEEL),
    ...[-1, 1].flatMap(s => [
      part(s * 0.85, 0.7, 0.7, 0.4, 1.4, 1.4, TYRE),
      part(s * 0.86, 0.7, 0.7, 0.42, 0.5, 0.5, HUB),
      part(s * 0.75, 0.4, -0.9, 0.3, 0.8, 0.8, TYRE),
    ]),
  ]
}

/** A crate with slats, and on every other stack a smaller one on top, a little turned */
function crates(k: number): Part[] {
  const base = [part(0, 0.65, 0, 1.3, 1.3, 1.3, CRATE), part(0, 0.25, 0, 1.34, 0.14, 1.34, SLAT), part(0, 1.05, 0, 1.34, 0.14, 1.34, SLAT)]
  return k % 2 ? base : [...base, part(0, 1.8, 0, 1, 1, 1, CRATE, 0.35), part(0, 1.8, 0, 1.04, 0.12, 1.04, SLAT, 0.35)]
}

/** How tall a prop's collider is: above her head for all of them */
const HEIGHT: Record<DistrictProp['kind'], number> = { tractor: 2.4, crate: 2.3, crane: CRANE_HEIGHT }

/** The crane's arm: a jib with a counterweight behind the mast and a hook hanging from its far end */
function craneArm(): Part[] {
  return [
    part(3, 0, 0, 12, 0.7, 0.7, CRANE),
    part(-2.6, -0.2, 0, 1.4, 1.2, 1.4, CONCRETE),
    part(0, -0.8, 0, 1.2, 1.1, 1.2, GLASS),
    part(8, -2.3, 0, 0.06, 4, 0.06, STEEL),
    part(8, -4.5, 0, 0.45, 0.45, 0.45, SLAT),
  ]
}

/**
 * Adds the districts' props, the farm's field and the grass in its pens to `parts`, gives the props colliders (she bumps into them, the
 * camera looks past them, as past trunks) and adds the crane's arm. Returns what turns the arm.
 */
export function buildDistrictProps(R: Rapier, world: RAPIER.World, scene: THREE.Scene, parts: PlacedPart[]) {
  const place = (x: number, z: number) => new THREE.Matrix4().makeTranslation(x, heightAt(x, z), z)
  const arms: THREE.Object3D[] = []
  ALL_PROPS.forEach((p, k) => {
    const at = place(p.x, p.z)
    const boxes = p.kind === 'tractor'
      ? tractor()
      : p.kind === 'crate'
        ? crates(k)
        : [part(0, 0.25, 0, p.w, 0.5, p.d, CONCRETE), part(0, CRANE_HEIGHT / 2, 0, 1.1, CRANE_HEIGHT, 1.1, CRANE)]
    for (const b of boxes) parts.push({ ...b, at })
    const h = HEIGHT[p.kind]
    world.createCollider(
      R.ColliderDesc.cuboid(p.w / 2, h / 2, p.d / 2).setTranslation(p.x, heightAt(p.x, p.z) + h / 2, p.z).setCollisionGroups(UNSEEN_GROUPS),
    )
    if (p.kind === 'crane') {
      const arm = new THREE.Group()
      arm.name = 'crane-arm'
      arm.position.set(p.x, heightAt(p.x, p.z) + CRANE_HEIGHT + 0.35, p.z)
      arm.add(...mergeParts(craneArm().map(b => ({ ...b, at: new THREE.Matrix4() })), Infinity))
      scene.add(arm)
      arms.push(arm)
    }
  })

  // Grass in the pens
  for (const p of PENS) {
    const at = place((p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2)
    parts.push({ ...part(0, 0.01, 0, p.maxX - p.minX, 0.02, p.maxZ - p.minZ, PASTURE), at })
  }

  // The field: brown soil with green rows along it
  const w = FIELD.maxX - FIELD.minX
  const d = FIELD.maxZ - FIELD.minZ
  const at = place((FIELD.minX + FIELD.maxX) / 2, (FIELD.minZ + FIELD.maxZ) / 2)
  parts.push({ ...part(0, 0.03, 0, w, 0.06, d, SOIL), at })
  const rows = 5
  for (let k = 0; k < rows; k++) parts.push({ ...part(-w / 2 + ((k + 0.5) * w) / rows, 0.15, 0, 0.5, 0.3, d - 0.6, CROP), at })

  return {
    update(timeS: number) {
      for (const arm of arms) arm.rotation.y = timeS * CRANE_TURN
    },
  }
}
