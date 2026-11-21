import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BODY_HEIGHT } from './character'

/** The wheels' radius, metres: big, so their tops show beside her from behind */
const WHEEL = 0.44
/** How far in front of and behind her middle the axles are: her body fits between the wheels */
const AXLE = 0.82
/** How high she sits above the ground on it: high enough that the wheels show under her too */
export const SADDLE_LIFT = 0.35
const TUBE = 0.08
/** The tyres are this thick: seen edge-on from behind they still read as wheels */
const TYRE = 0.065
/** Wider than she is (1 m round), so the bar and its grips stick out at either side of her */
const BAR_WIDTH = 1.15
const BAR_HEIGHT = 1.2

const TYRE_COLOR = 0x2b2b2b
const RIM_COLOR = 0xf4f4f4
const GRIP_COLOR = 0x2b2b2b
const REAR_LIGHT = 0xe53935
const FRONT_LIGHT = 0xfff3a0
const BASKET_COLOR = 0xf4f4f4

/** Strips what merging doesn't need, and paints every corner `color` (for a vertex-coloured material) */
function painted(g: THREE.BufferGeometry, color?: number): THREE.BufferGeometry {
  g.deleteAttribute('uv')
  if (color !== undefined) {
    const c = new THREE.Color(color)
    const colors = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  return g
}

/** A box from a to b in the bike's side plane (z forwards, y up) at x = `x` */
function tube(a: [number, number], b: [number, number], x = 0, width = TUBE): THREE.BufferGeometry {
  const [az, ay] = a, [bz, by] = b
  const g = new THREE.BoxGeometry(width, TUBE, Math.hypot(bz - az, by - ay))
  g.rotateX(-Math.atan2(by - ay, bz - az))
  g.translate(x, (ay + by) / 2, (az + bz) / 2)
  return painted(g)
}

/** A box of size w × h × d at (x, y, z) in `color` */
function block(w: number, h: number, d: number, x: number, y: number, z: number, color: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return painted(g, color)
}

/** Merges the parts into one geometry and lets the parts go */
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
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
 * Her bicycle, block-built, in four meshes: the frame in `paint` (her body's material, so it takes her colour whenever
 * her look changes); the bits in colours of their own (dark grips on a bar wider than she is, a red rear light on a
 * rack, a front light and a basket), so it reads as a bike from behind; and two big wheels, dark tyres with white rims
 * and spokes, that turn as it rides. Hidden until a ride starts.
 */
export function createBicycle(paint: THREE.Material): Bicycle {
  const root = new THREE.Group()
  root.visible = false

  // Side view, z forwards, y up, from the ground
  const seat: [number, number] = [-0.05, SADDLE_LIFT + 0.04]
  const head: [number, number] = [AXLE - 0.16, BAR_HEIGHT - 0.05]
  const rack = { from: -0.35, to: -AXLE - 0.12, y: WHEEL * 2 + 0.06 }
  const frame = new THREE.Mesh(merged([
    // The back stays, either side of the back wheel, and the struts up to the rack
    tube([-AXLE, WHEEL], seat, -0.1), tube([-AXLE, WHEEL], seat, 0.1),
    tube([-AXLE, WHEEL], [rack.to + 0.08, rack.y], -0.1), tube([-AXLE, WHEEL], [rack.to + 0.08, rack.y], 0.1),
    // The rack over the back wheel, the down tube and the fork round the front wheel
    tube([rack.from, rack.y], [rack.to, rack.y], 0, 0.26),
    tube(seat, [head[0] - 0.02, head[1] - 0.25]),
    tube([AXLE, WHEEL], head, -0.1), tube([AXLE, WHEEL], head, 0.1),
    // The stem and the handlebar
    tube(head, [head[0] - 0.02, BAR_HEIGHT]),
    tube([head[0] - 0.05, BAR_HEIGHT], [head[0] + 0.05, BAR_HEIGHT], 0, BAR_WIDTH),
    // The saddle, under her
    tube([seat[0] - 0.2, seat[1]], [seat[0] + 0.2, seat[1]], 0, 0.3),
  ]), paint)
  frame.castShadow = true

  const colored = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
  const bits = new THREE.Mesh(merged([
    // Grips at the bar's ends, out beside her
    block(0.16, 0.1, 0.1, -BAR_WIDTH / 2 + 0.06, BAR_HEIGHT, head[0], GRIP_COLOR),
    block(0.16, 0.1, 0.1, BAR_WIDTH / 2 - 0.06, BAR_HEIGHT, head[0], GRIP_COLOR),
    // A red light at the back of the rack, facing the camera when it is behind her
    block(0.28, 0.16, 0.06, 0, rack.y + 0.04, rack.to - 0.03, REAR_LIGHT),
    // A front light and a basket on the bar
    block(0.14, 0.12, 0.08, 0, BAR_HEIGHT - 0.14, head[0] + 0.12, FRONT_LIGHT),
    block(0.42, 0.26, 0.3, 0, BAR_HEIGHT - 0.12, head[0] + 0.3, BASKET_COLOR),
  ]), colored)
  bits.castShadow = true
  root.add(frame, bits)

  // A chunky tyre round a white rim, hub and spokes, so it reads edge-on and can be seen turning from the side
  const wheelGeometry = merged([
    painted(new THREE.TorusGeometry(WHEEL - TYRE, TYRE, 8, 24).rotateY(Math.PI / 2), TYRE_COLOR),
    painted(new THREE.TorusGeometry(WHEEL - 2 * TYRE - 0.02, 0.025, 6, 24).rotateY(Math.PI / 2), RIM_COLOR),
    painted(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10).rotateZ(Math.PI / 2), RIM_COLOR),
    ...[0, Math.PI / 3, (2 * Math.PI) / 3].map(a =>
      painted(new THREE.BoxGeometry(0.03, 0.03, 2 * (WHEEL - 2 * TYRE)).rotateX(a), RIM_COLOR)),
  ])
  const wheels = [-AXLE, AXLE].map(z => {
    const wheel = new THREE.Mesh(wheelGeometry, colored)
    wheel.name = 'wheel'
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
