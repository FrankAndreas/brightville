import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SADDLE_LIFT, createBicycle } from './bicycle'

const her = { x: 0, y: 0.6, z: 0, heading: 0 }
/** Her body, sitting on it: 1 m round, from the saddle up */
const BODY_HALF_WIDTH = 0.5

function shown() {
  const bike = createBicycle(new THREE.MeshStandardMaterial({ color: 0xff9a3c }))
  // Long enough to have grown in fully
  bike.update(her, true, 0, 1)
  bike.object.updateMatrixWorld(true)
  return bike
}

const meshes = (o: THREE.Object3D) => {
  const out: THREE.Mesh[] = []
  o.traverse(m => { if ((m as THREE.Mesh).isMesh) out.push(m as THREE.Mesh) })
  return out
}

describe('the bicycle', () => {
  it('is hidden until shown, and then stands under her', () => {
    const bike = createBicycle(new THREE.MeshStandardMaterial())
    expect(bike.object.visible).toBe(false)
    bike.update(her, true, 0, 1)
    expect(bike.object.visible).toBe(true)
    expect(bike.object.position.y).toBeCloseTo(0)
  })

  it('reads as a bike from behind: a handlebar wider than she is, and wheels showing above her saddle', () => {
    const box = new THREE.Box3().setFromObject(shown().object)
    expect(box.max.x).toBeGreaterThan(BODY_HALF_WIDTH + 0.03)
    expect(box.min.x).toBeLessThan(-BODY_HALF_WIDTH - 0.03)
    // The wheels reach well up past her seat, and are chunky enough to see edge-on
    const wheels = meshes(shown().object).filter(m => m.name === 'wheel')
    expect(wheels).toHaveLength(2)
    for (const w of wheels) {
      const b = new THREE.Box3().setFromObject(w)
      expect(b.max.y).toBeGreaterThan(SADDLE_LIFT + 0.4)
      expect(b.max.x - b.min.x).toBeGreaterThanOrEqual(0.11)
    }
  })

  it('has colours of its own beside her body colour: lights, grips and rims', () => {
    const colours = new Set<string>()
    for (const m of meshes(shown().object)) {
      const c = m.geometry.getAttribute('color')
      if (!c) continue
      for (let i = 0; i < c.count; i++) colours.add(`${c.getX(i).toFixed(2)},${c.getY(i).toFixed(2)},${c.getZ(i).toFixed(2)}`)
    }
    expect(colours.size).toBeGreaterThanOrEqual(4)
  })

  it('is a few meshes, and turns its wheels with the speed', () => {
    const bike = shown()
    expect(meshes(bike.object).length).toBeLessThanOrEqual(4)
    const wheel = meshes(bike.object).find(m => m.name === 'wheel')!
    const before = wheel.rotation.x
    bike.update(her, true, 6, 0.1)
    expect(wheel.rotation.x - before).toBeCloseTo(0.6 / 0.44, 1)
  })

  it('grows in under her when a ride starts and shrinks away when it ends, instead of popping', () => {
    const bike = createBicycle(new THREE.MeshStandardMaterial())
    bike.update(her, true, 0, 1 / 60)
    expect(bike.object.visible).toBe(true)
    expect(bike.presence).toBeGreaterThan(0)
    expect(bike.presence).toBeLessThan(0.2)
    for (let i = 0; i < 20; i++) bike.update(her, true, 0, 1 / 60)
    expect(bike.presence).toBe(1)
    expect(bike.object.scale.x).toBeCloseTo(1)
    bike.update(her, false, 0, 1 / 60)
    expect(bike.object.visible).toBe(true)
    expect(bike.presence).toBeLessThan(1)
    for (let i = 0; i < 20; i++) bike.update(her, false, 0, 1 / 60)
    expect(bike.presence).toBe(0)
    expect(bike.object.visible).toBe(false)
  })
})
