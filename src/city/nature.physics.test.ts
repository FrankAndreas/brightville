// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { buildNature, groundUnder, type NatureItem } from './nature'
import { heightAt } from './map'
import { createFollowCamera } from './followCamera'
import { GRAVITY, buildTown, cameraBlocker } from './world'

const tree: NatureItem = { kind: 'tree', x: 0, z: 30, rotY: 0.4, scale: 1, color: 0x4caf50 }
const bench: NatureItem = { kind: 'bench', x: 4, z: 30, rotY: 0, scale: 1, color: 0 }

function drop(items: NatureItem[], at: { x: number; y: number; z: number }) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 30))
  buildNature(RAPIER, world, new THREE.Scene(), items)
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z))
  world.createCollider(RAPIER.ColliderDesc.ball(0.3), ball)
  for (let i = 0; i < 300; i++) world.step()
  return ball.translation()
}

describe('nature to stand on', () => {
  beforeAll(() => RAPIER.init())

  it('lets her stand on a bench\'s seat, not above it', () => {
    expect(drop([bench], { x: bench.x, y: 3, z: bench.z + 0.1 }).y).toBeLessThan(0.51 + 0.3 + 0.05)
  })

  it('never lets anything rest on top of a tree', () => {
    expect(drop([tree], { x: tree.x, y: 8, z: tree.z }).y).toBeLessThan(1)
  })

  it('sinks each thing on a slope to the lowest ground under it, so nothing floats', () => {
    const item: NatureItem = { kind: 'bush', x: -26 + 7, z: -28, rotY: 0, scale: 1.2, color: 0 }
    const under = groundUnder(item)
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      expect(under).toBeLessThanOrEqual(heightAt(item.x + dx * item.scale, item.z + dz * item.scale) + 1e-9)
    }
    expect(under).toBeLessThan(heightAt(item.x, item.z))
  })
})

describe('the camera among trees', () => {
  beforeAll(() => RAPIER.init())

  it('doesn\'t jump about as she walks through a wood', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    buildTown(RAPIER, world, [])
    world.step()
    const blocked = cameraBlocker(RAPIER, world)
    const view = createFollowCamera()
    // Across the small hill in the park, full of trees, the camera behind her
    let jumps = 0
    let last: THREE.Vector3 | null = null
    for (let t = 0; t < 8; t += 1 / 60) {
      const x = -34 + t * 3
      const z = -50
      view.follow({ x, y: heightAt(x, z) + 0.6, z, grounded: true }, 1 / 60, t === 0, -Math.PI / 2, blocked)
      if (last && view.camera.position.distanceTo(last) > 0.6) jumps++
      last = view.camera.position.clone()
    }
    expect(jumps).toBe(0)
  })
})
