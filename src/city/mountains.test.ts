import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFollowCamera } from './followCamera'
import { DISTANCE, SNOW, createMountains } from './mountains'

function setup() {
  const scene = new THREE.Scene()
  const mountains = createMountains(scene)
  const group = scene.children[0]
  const meshes: THREE.Mesh[] = []
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
  return { scene, mountains, group, meshes }
}

const deg = (rad: number) => (rad * 180) / Math.PI

describe('createMountains', () => {
  it('sits 150 m behind the camera, whatever it does', () => {
    const { mountains, group } = setup()
    mountains.follow(10, -80)
    expect(group.position.toArray()).toEqual([10, 0, -80 - DISTANCE])
    mountains.follow(-20, -50)
    expect(group.position.toArray()).toEqual([-20, 0, -50 - DISTANCE])
  })

  it('is a cheap backdrop: no fog, no shadows, drawn first and never into the depth buffer', () => {
    const { meshes } = setup()
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.length).toBeLessThanOrEqual(2)
    for (const m of meshes) {
      expect(m.castShadow).toBe(false)
      expect(m.receiveShadow).toBe(false)
      expect(m.renderOrder).toBeLessThan(0)
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const material = mat as THREE.MeshStandardMaterial
        expect(material.fog).toBe(false)
        expect(material.depthWrite).toBe(false)
        expect(material.depthTest).toBe(false)
      }
    }
  })

  it('is flat-shaded with snow, and wide enough for a 60 degree view', () => {
    const { meshes } = setup()
    const box = new THREE.Box3()
    for (const m of meshes) box.union(new THREE.Box3().setFromObject(m))
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(2 * 150 * Math.tan(Math.PI / 6) + 40)
    const colors = meshes[0].geometry.attributes.color
    const white = new THREE.Color(SNOW)
    let snowy = 0
    for (let i = 0; i < colors.count; i++) if (colors.getX(i) === white.r && colors.getY(i) === white.g && colors.getZ(i) === white.b) snowy++
    expect(snowy).toBeGreaterThan(0)
    for (const m of meshes) expect((m.material as THREE.MeshStandardMaterial).flatShading).toBe(true)
  })

  it('shows its peaks and their snow in the default view, above the horizon and under the top of the picture', () => {
    const { mountains, group, meshes } = setup()
    // The follow camera as it starts, on level ground: its own height, pitch and field of view
    const view = createFollowCamera()
    view.camera.aspect = 1180 / 820
    view.follow({ x: 0, y: 0.6, z: 5 }, 0, true)
    const cam = view.camera
    cam.updateMatrixWorld()
    mountains.follow(cam.position.x, cam.position.z)
    group.updateMatrixWorld(true)
    const topEdge = deg(Math.asin(cam.getWorldDirection(new THREE.Vector3()).y)) + cam.fov / 2

    const geometry = meshes[0].geometry
    const position = geometry.attributes.position
    const colors = geometry.attributes.color
    const white = new THREE.Color(SNOW)
    const v = new THREE.Vector3()
    let highest = -Infinity
    let snowBase = Infinity
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(meshes[0].matrixWorld)
      const angle = deg(Math.atan2(v.y - cam.position.y, cam.position.z - v.z))
      highest = Math.max(highest, angle)
      if (colors.getX(i) === white.r) snowBase = Math.min(snowBase, angle)
    }
    expect(highest).toBeLessThan(topEdge)
    // The tallest peak is well in the picture, not just touching its edge
    expect(highest).toBeGreaterThan(topEdge * 0.5)
    // Even the lowest snow is up in the sky, not hidden behind the town's roofs at the horizon
    expect(snowBase).toBeGreaterThan(0.5)
  })

  it('leaves the scene when disposed', () => {
    const { scene, mountains } = setup()
    mountains.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
