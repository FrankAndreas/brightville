import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** How far behind the camera the range stands: always the same, so it never comes closer */
export const DISTANCE = 150
/** Wide enough for a 60 degree view from anywhere in the town, even on a wide screen */
const WIDTH = 520
export const ROCK = 0x6f80a8
export const SNOW = 0xffffff
/** The follow camera's usual height; the peaks are placed by the angle they rise at from there */
const EYE = 6
/** The peaks' feet sink below the ground (the town's ground hides them) */
const FOOT = -10
/** Peak tops rise this many degrees above the horizon: inside the picture, which ends about 6.6 degrees up */
const TOP_ANGLE = [3.2, 5.0]
/** Snow starts this far (of the way from the horizon to the top) up, so it is plainly in the picture */
const SNOW_START = 0.45

/** One cone as flat-coloured triangles, from `foot` to `top` */
function cone(radius: number, foot: number, top: number, sides: number, x: number, z: number, turn: number, color: number) {
  const height = top - foot
  const g = new THREE.ConeGeometry(radius, height, sides, 1, false)
  g.deleteAttribute('uv')
  g.rotateY(turn)
  g.translate(x, foot + height / 2, z)
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/**
 * A range of blocky snow-capped peaks as one mesh, a backdrop only: it follows the camera (so its distance only sets how
 * big it looks), is drawn first and never touches the depth buffer (it can't cover the town), ignores the fog, casts and
 * receives no shadows and has no physics.
 */
export function createMountains(scene: THREE.Scene) {
  const parts: THREE.BufferGeometry[] = []
  // Two rows, the back one a little higher; a seeded wobble keeps them uneven but the same every time
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const row of [{ back: 0, step: 56, rise: 0 }, { back: 15, step: 70, rise: 0.4 }]) {
    const distance = DISTANCE + row.back
    for (let x = -WIDTH / 2; x <= WIDTH / 2; x += row.step) {
      const px = x + (rand() - 0.5) * row.step * 0.5
      const angle = Math.min(TOP_ANGLE[0] + rand() * (TOP_ANGLE[1] - TOP_ANGLE[0]) + row.rise, TOP_ANGLE[1] + 0.6)
      const top = EYE + distance * Math.tan((angle * Math.PI) / 180)
      const slope = 1
      const snow = EYE + (top - EYE) * SNOW_START
      const turn = rand() * Math.PI
      const sides = 5 + Math.floor(rand() * 3)
      const z = -row.back
      parts.push(cone((top - FOOT) * slope, FOOT, top, sides, px, z, turn, ROCK))
      parts.push(cone((top - snow) * slope * 1.03, snow, top, sides, px, z, turn, SNOW))
    }
  }
  const geometry = mergeGeometries(parts)
  if (!geometry) throw new Error('mountains: the peaks did not merge')
  for (const p of parts) p.dispose()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, fog: false, depthTest: false, depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  // Before everything else, so the town is always drawn over it
  mesh.renderOrder = -1000
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
