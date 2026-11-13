import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFollowCamera } from './followCamera'

describe('createFollowCamera', () => {
  it('looks from behind and above, at the learning row when not turned', () => {
    const view = createFollowCamera()
    view.follow({ x: 2, y: 0, z: 3 }, 0, true)
    expect(view.camera.position.x).toBeCloseTo(2)
    expect(view.camera.position.y).toBeCloseTo(6)
    expect(view.camera.position.z).toBeCloseTo(12)
  })

  it('swings around the character when the view is turned', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0, z: 0 }, 0, true, Math.PI / 2)
    expect(view.camera.position.x).toBeCloseTo(9)
    expect(view.camera.position.z).toBeCloseTo(0)
    // Looking past the character, so towards -x
    const ahead = view.camera.getWorldDirection(view.camera.position.clone())
    expect(ahead.x).toBeLessThan(-0.5)
  })

  it('looks ahead of the character, so she stands low in the picture and the buildings sit in the middle', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0, z: 0 }, 0, true)
    view.camera.updateMatrixWorld()
    const character = new THREE.Vector3(0, 0.5, 0).project(view.camera)
    const sign = new THREE.Vector3(0, 4, -24).project(view.camera)
    // Normalised screen height: -1 bottom, 0 middle, 1 top
    expect(character.y).toBeLessThan(-0.3)
    expect(sign.y).toBeGreaterThan(0)
    expect(sign.y).toBeLessThan(0.7)
  })
})
