import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createMountains } from './mountains'

function setup() {
  const scene = new THREE.Scene()
  const mountains = createMountains(scene)
  const group = scene.children[0]
  const meshes: THREE.Mesh[] = []
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  return { scene, mountains, group, meshes }
}

describe('createMountains', () => {
  it('sits 150 m behind the camera, whatever it does', () => {
    const { mountains, group } = setup()
    mountains.follow(10, -80)
    expect(group.position.toArray()).toEqual([10, 0, -230])
    mountains.follow(-20, -50)
    expect(group.position.toArray()).toEqual([-20, 0, -200])
  })

  it('ignores the fog, casts no shadows and stays cheap', () => {
    const { meshes } = setup()
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.length).toBeLessThanOrEqual(2)
    for (const m of meshes) {
      expect(m.castShadow).toBe(false)
      expect(m.receiveShadow).toBe(false)
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) expect((mat as THREE.MeshStandardMaterial).fog).toBe(false)
    }
  })

  it('has flat-shaded, snowy peaks wide enough to fill a 60 degree view', () => {
    const { meshes } = setup()
    const box = new THREE.Box3()
    for (const m of meshes) box.union(new THREE.Box3().setFromObject(m))
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(2 * 150 * Math.tan(Math.PI / 6) + 40)
    for (const m of meshes) expect((m.material as THREE.MeshStandardMaterial).flatShading).toBe(true)
  })

  it('leaves the scene when disposed', () => {
    const { scene, mountains } = setup()
    mountains.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
