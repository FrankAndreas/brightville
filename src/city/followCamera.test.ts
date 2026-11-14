import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFollowCamera } from './followCamera'

describe('createFollowCamera', () => {
  it('looks from behind and above, along -z when not turned', () => {
    const view = createFollowCamera()
    // Standing on the flat: her middle is 0.6 m up
    view.follow({ x: 2, y: 0.6, z: 3 }, 0, true)
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

  it('pulls the camera in front of a house between it and her', () => {
    const view = createFollowCamera()
    const blocked = () => 4
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true, 0, blocked)
    const head = new THREE.Vector3(0, 0.6 + 1, 0)
    expect(view.camera.position.distanceTo(head)).toBeLessThanOrEqual(3.8)
    // Still behind her, on the same line
    expect(view.camera.position.z).toBeGreaterThan(0)
    expect(view.camera.position.x).toBeCloseTo(0)
  })

  it('keeps her framed the same way on a hill as on the flat', () => {
    const flat = createFollowCamera()
    flat.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true)
    const hill = createFollowCamera()
    hill.follow({ x: 0, y: 4.6, z: 0, grounded: true }, 0, true)
    for (let i = 0; i < 120; i++) hill.follow({ x: 0, y: 4.6, z: 0, grounded: true }, 1 / 60)
    expect(hill.camera.position.y - 4).toBeCloseTo(flat.camera.position.y, 1)
  })

  it('follows a jump only loosely, so the picture doesn\'t shake', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true)
    const before = view.camera.position.y
    for (let i = 0; i < 18; i++) view.follow({ x: 0, y: 1.8, z: 0, grounded: false }, 1 / 60)
    expect(view.camera.position.y - before).toBeLessThan(0.5)
  })

  it('rises above her instead of pressing against her when a house is right behind her', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true, 0, () => 0.5)
    const head = new THREE.Vector3(0, 0.6 + 1, 0)
    expect(view.camera.position.distanceTo(head)).toBeGreaterThanOrEqual(2.5)
    expect(view.camera.position.y - head.y).toBeGreaterThanOrEqual(4)
    // Still looking at where she goes, with her in the picture
    const ahead = view.camera.getWorldDirection(new THREE.Vector3())
    expect(ahead.z).toBeLessThan(0)
    view.camera.updateMatrixWorld()
    const her = new THREE.Vector3(0, 0.6, 0).project(view.camera)
    expect(her.y).toBeGreaterThan(-0.9)
    expect(her.y).toBeLessThan(0.5)
  })

  it('climbs higher behind her to see over the houses before it comes closer', () => {
    const view = createFollowCamera()
    // Houses 8 m high everywhere behind her: only a camera above 10 m sees her
    const blocked = (_from: { y: number }, to: { y: number }) => (to.y >= 10 ? null : 2)
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true, 0, blocked)
    expect(view.camera.position.y).toBeGreaterThanOrEqual(10)
    // As far back as it can, not on top of her
    expect(Math.hypot(view.camera.position.x, view.camera.position.z)).toBeGreaterThanOrEqual(4)
    view.camera.updateMatrixWorld()
    const her = new THREE.Vector3(0, 0.6, 0).project(view.camera)
    expect(her.y).toBeGreaterThan(-0.9)
    expect(her.y).toBeLessThan(0.5)
  })

  it('glides to a new place instead of jumping', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 0, true)
    const before = view.camera.position.clone()
    const blocked = (_from: { y: number }, to: { y: number }) => (to.y >= 10 ? null : 2)
    view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 1 / 60, false, 0, blocked)
    expect(view.camera.position.y - before.y).toBeLessThan(1.5)
    for (let i = 0; i < 90; i++) view.follow({ x: 0, y: 0.6, z: 0, grounded: true }, 1 / 60, false, 0, blocked)
    expect(view.camera.position.y).toBeGreaterThan(9.5)
  })
})
