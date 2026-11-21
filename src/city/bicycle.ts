import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BODY_HEIGHT } from './character'

/** The wheels' radius, metres */
const WHEEL = 0.3
/** How far in front of and behind her middle the axles are: her body fits between the wheels */
const AXLE = 0.72
/** How high she sits above the ground on it */
export const SADDLE_LIFT = 0.25
const TUBE = 0.07
const TYRE_COLOR = 0x333333

/** A thin box from a to b (in the bike's side plane, x = `x`), as part of the frame */
function tube(a: [number, number], b: [number, number], x = 0, width = TUBE): THREE.BufferGeometry {
  const [az, ay] = a, [bz, by] = b
  const length = Math.hypot(bz - az, by - ay)
  const g = new THREE.BoxGeometry(width, TUBE, length)
  g.deleteAttribute('uv')
  g.rotateX(-Math.atan2(by - ay, bz - az))
  g.translate(x, (ay + by) / 2, (az + bz) / 2)
  return g
}

export interface Bicycle {
  object: THREE.Object3D
  /**
   * Under her while `shown`, at her feet (`y`: her middle, as CharacterFrame.y) and facing her heading; the wheels
   * turn with `speed`
   */
  update(f: { x: number; y: number; z: number; heading: number }, shown: boolean, speed: number, dt: number): void
}

/**
 * Her bicycle, block-built: one merged mesh for the frame in `paint` (her body's material, so it takes her colour
 * whenever her look changes) and two wheels with spokes that turn as it rides. Hidden until a ride starts.
 */
export function createBicycle(paint: THREE.Material): Bicycle {
  const root = new THREE.Group()
  root.visible = false

  // Side view, z forwards, y up, from the ground
  const seat: [number, number] = [-0.05, 0.3]
  const bar: [number, number] = [AXLE - 0.12, 1.0]
  const tubes = [
    tube([-AXLE, WHEEL], seat, -0.08), tube([-AXLE, WHEEL], seat, 0.08), // the back stays, either side of the wheel
    tube(seat, [AXLE - 0.1, 0.62]), // the down tube
    tube([AXLE, WHEEL], bar, -0.08), tube([AXLE, WHEEL], bar, 0.08), // the fork
    tube([bar[0] - 0.01, bar[1]], [bar[0] + 0.01, bar[1]], 0, 0.8), // the handlebar
    tube([seat[0] - 0.2, 0.3], [seat[0] + 0.2, 0.3], 0, 0.3), // the saddle, under her
  ]
  const frameGeometry = mergeGeometries(tubes)!
  for (const g of tubes) g.dispose()
  const frame = new THREE.Mesh(frameGeometry, paint)
  frame.castShadow = true
  root.add(frame)

  // A tyre with two crossing spokes, so it can be seen turning
  const tyre = new THREE.TorusGeometry(WHEEL - 0.04, 0.045, 6, 18)
  tyre.deleteAttribute('uv')
  tyre.rotateY(Math.PI / 2)
  const spokes = [0, Math.PI / 2].map(a => {
    const g = new THREE.BoxGeometry(0.03, 0.03, 2 * (WHEEL - 0.06))
    g.deleteAttribute('uv')
    g.rotateX(a)
    return g
  })
  const wheelGeometry = mergeGeometries([tyre, ...spokes])!
  for (const g of [tyre, ...spokes]) g.dispose()
  const rubber = new THREE.MeshStandardMaterial({ color: TYRE_COLOR, roughness: 0.9 })
  const wheels = [-AXLE, AXLE].map(z => {
    const wheel = new THREE.Mesh(wheelGeometry, rubber)
    wheel.position.set(0, WHEEL, z)
    wheel.castShadow = true
    root.add(wheel)
    return wheel
  })

  return {
    object: root,
    update(f, shown, speed, dt) {
      root.visible = shown
      if (!shown) return
      root.position.set(f.x, f.y - BODY_HEIGHT / 2, f.z)
      root.rotation.set(0, f.heading, 0)
      // Rolling forwards (+z) turns the top of the wheel forwards
      for (const wheel of wheels) wheel.rotation.x += (speed * dt) / WHEEL
    },
  }
}
