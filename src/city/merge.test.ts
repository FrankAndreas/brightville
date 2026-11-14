import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { houseParts } from './houseKit'
import { CELL, mergeParts, type PlacedPart } from './merge'

const spec = { w: 6, d: 5, floors: 2 as const, wall: 0xffc8dd, roof: 0xff8fab, seed: 1, door: false }

describe('mergeParts', () => {
  it('merges a hundred houses into at most one mesh per 30 m cell', () => {
    const placed: PlacedPart[] = []
    const cells = new Set<string>()
    let boxes = 0
    for (let i = 0; i < 100; i++) {
      const x = ((i * 37) % 110) - 55
      const z = ((i * 53) % 110) - 55
      cells.add(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)
      const at = new THREE.Matrix4().makeRotationY((i % 4) * (Math.PI / 2)).setPosition(x, 0, z)
      const parts = houseParts({ ...spec, seed: i })
      boxes += parts.length
      placed.push(...parts.map(p => ({ ...p, at })))
    }
    const meshes = mergeParts(placed)
    expect(meshes.length).toBeLessThanOrEqual(cells.size)
    // Every box is there: 24 corners each
    expect(meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0)).toBe(boxes * 24)
    // One material for all of them
    expect(new Set(meshes.map(m => m.material)).size).toBe(1)
  })

  it('keeps each part\'s colour in the vertex colours, and puts it where the house stands', () => {
    const at = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(10, 0, -20)
    const [mesh] = mergeParts([{ kind: 'walls', x: 1, y: 0.5, z: 0, w: 1, h: 1, d: 1, color: 0xff0000, at }])
    const color = mesh.geometry.attributes.color
    const red = new THREE.Color(0xff0000)
    for (let i = 0; i < color.count; i++) expect([color.getX(i), color.getY(i), color.getZ(i)]).toEqual([red.r, red.g, red.b])
    mesh.geometry.computeBoundingBox()
    const centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())
    // 1 m along the house's x, turned a quarter: 1 m towards -z
    expect(centre.x).toBeCloseTo(10)
    expect(centre.z).toBeCloseTo(-21)
    expect(centre.y).toBeCloseTo(0.5)
  })
})
