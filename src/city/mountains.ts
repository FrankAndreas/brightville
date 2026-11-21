import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** How far behind the camera the range stands: always the same, so it never comes closer */
const DISTANCE = 150
/** Wide enough for a 60 degree view from anywhere in the town, even on a wide screen */
const WIDTH = 520
const ROCK = 0x8d95a8
const SNOW = 0xf7f9fc

/** One cone as flat-coloured triangles */
function cone(radius: number, height: number, sides: number, x: number, z: number, y: number, turn: number, color: number) {
  const g = new THREE.ConeGeometry(radius, height, sides, 1, false)
  g.deleteAttribute('uv')
  g.rotateY(turn)
  g.translate(x, y + height / 2, z)
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/**
 * A range of blocky snow-capped peaks as one mesh. It is a backdrop only: it follows the camera, ignores the fog (the
 * far peaks are past where it fades out), casts and receives no shadows and has no physics.
 */
export function createMountains(scene: THREE.Scene) {
  const parts: THREE.BufferGeometry[] = []
  // Two rows of peaks, the back one taller; a seeded wobble keeps them uneven but the same every time
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const row of [{ z: 0, h: 60, step: 44 }, { z: -40, h: 90, step: 60 }]) {
    for (let x = -WIDTH / 2; x <= WIDTH / 2; x += row.step) {
      const px = x + (rand() - 0.5) * row.step * 0.5
      const h = row.h * (0.7 + rand() * 0.6)
      const r = h * (0.7 + rand() * 0.3)
      const turn = rand() * Math.PI
      const sides = 5 + Math.floor(rand() * 3)
      const z = row.z + (rand() - 0.5) * 12
      parts.push(cone(r, h, sides, px, z, 0, turn, ROCK))
      // The cap is the same cone's top third, a little wider so it reads as snow lying over the rock
      const cap = h * 0.38
      parts.push(cone(r * 0.38 * 1.04, cap, sides, px, z, h - cap, turn, SNOW))
    }
  }
  const geometry = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  const group = new THREE.Group()
  group.add(mesh)
  group.position.set(0, 0, -DISTANCE)
  scene.add(group)

  return {
    follow(cameraX: number, cameraZ: number) {
      group.position.set(cameraX, 0, cameraZ - DISTANCE)
    },
    dispose() {
      scene.remove(group)
      geometry.dispose()
      material.dispose()
    },
  }
}
