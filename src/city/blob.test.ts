import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createBlob } from './blob'

const triangles = (o: THREE.Object3D) => {
  let n = 0
  o.traverse(m => {
    const g = (m as THREE.Mesh).geometry
    if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  return n
}

describe('createBlob', () => {
  it('makes a simpler wobbly for the townsfolk: under half the triangles, and no shadows', () => {
    const full = createBlob()
    const simple = createBlob(undefined, 'low')
    expect(triangles(simple.object)).toBeLessThan(triangles(full.object) / 2)
    let shadows = 0
    simple.object.traverse(o => { if (o.castShadow) shadows++ })
    expect(shadows).toBe(0)
  })
})
