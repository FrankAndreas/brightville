import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Part } from './houseKit'

/** A house's part and where the house stands (its position and turn) */
export type PlacedPart = Part & { at: THREE.Matrix4 }

/** Parts are merged per square of this many metres, so the camera can still skip the squares out of sight */
export const CELL = 30

/**
 * Many coloured boxes as a few meshes: one per CELL square, all sharing one material that takes each box's colour
 * from its corners. A town of a few thousand boxes is then a few draw calls, not thousands.
 */
export function mergeParts(parts: PlacedPart[]): THREE.Mesh[] {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  const cells = new Map<string, THREE.BufferGeometry[]>()
  const centre = new THREE.Vector3()
  const color = new THREE.Color()
  for (const p of parts) {
    const box = new THREE.BoxGeometry(p.w, p.h, p.d)
    box.deleteAttribute('uv')
    if (p.rotY) box.rotateY(p.rotY)
    box.translate(p.x, p.y, p.z)
    box.applyMatrix4(p.at)
    color.setHex(p.color)
    const colors = new Float32Array(box.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i)
    box.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    centre.set(p.x, p.y, p.z).applyMatrix4(p.at)
    const key = `${Math.floor(centre.x / CELL)},${Math.floor(centre.z / CELL)}`
    const list = cells.get(key) ?? []
    list.push(box)
    cells.set(key, list)
  }
  const meshes: THREE.Mesh[] = []
  for (const boxes of cells.values()) {
    const geometry = mergeGeometries(boxes)
    for (const b of boxes) b.dispose()
    if (!geometry) continue
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.push(mesh)
  }
  return meshes
}
