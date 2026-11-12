import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

type Rapier = typeof RAPIER

export interface Trampoline {
  x: number
  z: number
  radius: number
  /** Height of the bouncing surface */
  top: number
}

export const TRAMPOLINE: Trampoline = { x: 7, z: 8, radius: 2, top: 0.3 }

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
  /** Squashes the trampoline pad for a moment after a bounce */
  bounce(): void
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

  const t = TRAMPOLINE
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

  let dip = 0
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
    bounce() { dip = 1 },
    update(dt) {
      dip = Math.max(0, dip - dt * 4)
      pad.position.y = t.top + 0.03 - dip * 0.12
    },
  }
}
