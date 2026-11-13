import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '@/core/look'
import { OUTFITS, PLACES } from '@/core/outfits'
import { createBlob } from './blob'
import { dressParts } from './dress'

const meshes = (parts: THREE.Object3D[]) => {
  let n = 0
  for (const p of parts) p.traverse(o => { if ((o as THREE.Mesh).isMesh) n += 1 })
  return n
}
const PART_GROUP = { head: 'head', neck: 'neck', body: 'torso', back: 'back' } as const

describe('dressing the wobbly character', () => {
  it('adds nothing to the plain look', () => {
    const p = dressParts({ look: DEFAULT_LOOK, worn: {} })
    for (const group of [p.head, p.face, p.neck, p.torso, p.back]) expect(meshes(group)).toBe(0)
    expect(p.body).toBe(0xff9a3c)
  })

  it('gives buns two parts on the head, and round glasses parts on the face', () => {
    expect(meshes(dressParts({ look: { ...DEFAULT_LOOK, hair: 'buns' }, worn: {} }).head)).toBeGreaterThanOrEqual(2)
    expect(meshes(dressParts({ look: { ...DEFAULT_LOOK, glasses: 'round' }, worn: {} }).face)).toBeGreaterThan(0)
  })

  it('darkens the limbs a little from the body colour', () => {
    const p = dressParts({ look: DEFAULT_LOOK, worn: {} })
    expect(p.limbs).not.toBe(p.body)
    expect(new THREE.Color(p.limbs).getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(new THREE.Color(p.body).getHSL({ h: 0, s: 0, l: 0 }).l)
  })

  it('puts a crown on the head and fairy wings on the back', () => {
    const p = dressParts({ look: DEFAULT_LOOK, worn: { head: 'krone', back: 'feenfluegel' } })
    expect(meshes(p.head)).toBeGreaterThan(0)
    expect(meshes(p.back)).toBeGreaterThan(0)
  })

  it('skips an add-on it doesn\'t know, without failing', () => {
    const p = dressParts({ look: DEFAULT_LOOK, worn: { head: 'gibtsnicht' } })
    expect(meshes(p.head)).toBe(0)
  })

  it('builds every add-on of the catalogue in its own place', () => {
    for (const o of OUTFITS) {
      const p = dressParts({ look: DEFAULT_LOOK, worn: { [o.place]: o.id } })
      expect(meshes(p[PART_GROUP[o.place]]), o.id).toBeGreaterThan(0)
      for (const other of PLACES.filter(pl => pl !== o.place)) expect(meshes(p[PART_GROUP[other]]), `${o.id} ${other}`).toBe(0)
    }
  })

  it('changes clothes on the blob: only the newest dress is on it', () => {
    const blob = createBlob()
    const count = () => meshes([blob.object])
    const plain = count()
    blob.setDress({ look: { ...DEFAULT_LOOK, hair: 'curly' }, worn: { head: 'krone' } })
    const first = count()
    expect(first).toBeGreaterThan(plain)
    blob.setDress({ look: DEFAULT_LOOK, worn: {} })
    expect(count()).toBe(plain)
  })
})
