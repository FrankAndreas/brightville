import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

type Rapier = typeof RAPIER

export interface Trampoline {
  x: number
  z: number
  radius: number
  /** Height of the bouncing surface */
  top: number
  /** How high it throws, metres */
  height: number
}

/** The first trampoline, near the plaza */
export const TRAMPOLINE: Trampoline = { x: 7, z: 8, radius: 2, top: 0.3, height: 4 }

/** Every trampoline: the first one, a big one in the playground at the front, and a small one beside the first */
export const TRAMPOLINES: Trampoline[] = [
  TRAMPOLINE,
  { x: -14, z: 18, radius: 2.6, top: 0.4, height: 7 },
  { x: 8, z: 15, radius: 1.2, top: 0.25, height: 2.5 },
]

/** Something solid to climb or hop over: centre, width (x), depth (z) and height, metres */
export interface Block {
  kind: 'step' | 'platform' | 'hurdle'
  x: number
  z: number
  w: number
  d: number
  h: number
  color: number
}

const STEP_COLORS = [0xff8fab, 0xffd93d, 0x95d5b2, 0x8ecae6]

/**
 * The playground: a staircase whose steps are each a jump higher (too high to just walk up) to a platform,
 * and low hurdles to hop over.
 */
export const BLOCKS: Block[] = [
  ...STEP_COLORS.map((color, i): Block => ({ kind: 'step', x: 5 + i * 2, z: 22, w: 2, d: 2.4, h: 0.5 * (i + 1), color })),
  { kind: 'platform', x: 14, z: 22, w: 4, d: 4, h: 2.5, color: 0xc8b6ff },
  ...[13, 16, 19].map((z): Block => ({ kind: 'hurdle', x: 0, z, w: 3, d: 0.3, h: 0.45, color: 0xff9a3c })),
]

const BALLS: { x: number; z: number; radius: number; color: number }[] = [
  { x: -6, z: 2, radius: 0.9, color: 0xff8fab },
  { x: -8, z: -3, radius: 0.6, color: 0x8ecae6 },
  { x: -4, z: -5, radius: 0.45, color: 0xffd93d },
  { x: 4, z: -4, radius: 0.7, color: 0x95d5b2 },
  { x: -3, z: 6, radius: 0.5, color: 0xc8b6ff },
]

export interface Props {
  /** Copies physics positions to the meshes */
  sync(): void
  /** Squashes the pad of the trampoline at (x, z) for a moment after a bounce */
  bounce(x: number, z: number): void
  update(dt: number): void
}

export function buildProps(R: Rapier, world: RAPIER.World, scene: THREE.Scene): Props {
  const balls = BALLS.map(def => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius, 24, 16),
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6 }),
    )
    mesh.castShadow = true
    scene.add(mesh)
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(def.x, def.radius, def.z).setLinearDamping(0.4).setAngularDamping(0.5),
    )
    // Light and bouncy, so even a small push sends them rolling
    world.createCollider(R.ColliderDesc.ball(def.radius).setRestitution(0.7).setFriction(0.8).setDensity(0.15), body)
    return { mesh, body }
  })

  const pads = TRAMPOLINES.map(t => {
    const frame = new THREE.Mesh(
      new THREE.CylinderGeometry(t.radius, t.radius, t.top, 32),
      new THREE.MeshStandardMaterial({ color: 0x4d96ff, roughness: 0.8 }),
    )
    frame.position.set(t.x, t.top / 2, t.z)
    frame.castShadow = true
    frame.receiveShadow = true
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(t.radius * 0.82, t.radius * 0.82, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.7 }),
    )
    pad.position.set(t.x, t.top + 0.03, t.z)
    pad.receiveShadow = true
    scene.add(frame, pad)
    world.createCollider(R.ColliderDesc.cylinder(t.top / 2, t.radius).setTranslation(t.x, t.top / 2, t.z))
    return { t, pad, dip: 0 }
  })

  for (const b of BLOCKS) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 }),
    )
    mesh.position.set(b.x, b.h / 2, b.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    world.createCollider(R.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.h / 2, b.z))
  }

  return {
    sync() {
      for (const { mesh, body } of balls) {
        const p = body.translation()
        const q = body.rotation()
        mesh.position.set(p.x, p.y, p.z)
        mesh.quaternion.set(q.x, q.y, q.z, q.w)
        // A ball that somehow left the world comes back
        if (p.y < -5) {
          body.setTranslation({ x: 0, y: 3, z: 0 }, true)
          body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
      }
    },
    bounce(x, z) {
      const hit = pads.find(p => Math.hypot(p.t.x - x, p.t.z - z) <= p.t.radius)
      if (hit) hit.dip = 1
    },
    update(dt) {
      for (const p of pads) {
        p.dip = Math.max(0, p.dip - dt * 4)
        p.pad.position.y = p.t.top + 0.03 - p.dip * 0.12
      }
    },
  }
}
