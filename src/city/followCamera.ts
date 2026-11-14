import * as THREE from 'three'

// From behind and above; the child turns it only with J/L/K/I or the turn buttons
const BACK = 9
const HEIGHT = 6
const LOOK_HEIGHT = 1
// The camera looks at a spot this far ahead of the character, not at the character: she stands in the lower part of
// the picture, and the buildings with their signs sit in the middle instead of under the Star bar (UX review)
const LOOK_AHEAD = 6
const FOLLOW_RATE = 5
/** How quickly the camera glides to a higher or further place (it comes closer at once, never through a wall) */
const PLACE_RATE = 4
// Up and down only slowly while she is in the air, so jumps don't shake the whole picture; on the ground (a hill) at
// the full rate, so she stays where she is in the picture
const AIR_RATE = 1
/** How far in front of a house or hill the camera stops when one is between it and her */
const CLEARANCE = 0.3
/**
 * Where the camera may sit, tried in turn: the usual place first, then higher and a little closer, looking less far
 * ahead so she stays in the picture. The first with nothing between it and her wins.
 */
const PLACES = [
  { up: HEIGHT, back: BACK, lookAhead: LOOK_AHEAD },
  { up: 9, back: 8, lookAhead: 4 },
  { up: 12, back: 6.5, lookAhead: 2.5 },
  { up: 15, back: 5, lookAhead: 1.5 },
]
/** Closer than this, the camera would press against her: it goes straight above her instead and looks down */
const MIN_BACK = 3
const OVERHEAD = { up: 5, lookAhead: 1 }
/** Where she stands, at rest on the ground: y is her middle */
const REST_Y = 0.6

type Vec3 = { x: number; y: number; z: number }

export function createFollowCamera(): {
  camera: THREE.PerspectiveCamera
  /**
   * `yaw`: how far the view is turned (0 looks along -z); the camera sits at (sin, cos) behind. `blocked` tells how
   * far from her head towards the camera the first house or hill is (null when clear): the camera stops in front of it.
   */
  follow(
    target: Vec3 & { grounded?: boolean }, dt: number, snap?: boolean, yaw?: number,
    blocked?: (from: Vec3, to: Vec3) => number | null,
  ): void
  resize(width: number, height: number): void
} {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  const focus = new THREE.Vector3()
  const wanted = new THREE.Vector3()
  let ahead = LOOK_AHEAD
  return {
    camera,
    follow(target, dt, snap = false, yaw = 0, blocked) {
      const blend = snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt)
      const rise = snap ? 1 : 1 - Math.exp(-(target.grounded === false ? AIR_RATE : FOLLOW_RATE) * dt)
      focus.x += (target.x - focus.x) * blend
      focus.z += (target.z - focus.z) * blend
      focus.y += (target.y - REST_Y - focus.y) * rise
      const head = { x: focus.x, y: focus.y + LOOK_HEIGHT, z: focus.z }
      const at = (p: (typeof PLACES)[number]) =>
        ({ x: focus.x + Math.sin(yaw) * p.back, y: focus.y + p.up, z: focus.z + Math.cos(yaw) * p.back })
      let lookAhead = LOOK_AHEAD
      let best: { place: Vec3; hit: number; lookAhead: number } | null = null
      let clear = false
      for (const p of PLACES) {
        const place = at(p)
        const hit = blocked?.(head, place) ?? null
        if (hit === null) {
          wanted.set(place.x, place.y, place.z)
          lookAhead = p.lookAhead
          clear = true
          break
        }
        if (!best || hit > best.hit) best = { place, hit, lookAhead: p.lookAhead }
      }
      if (!clear && best && best.hit - CLEARANCE >= MIN_BACK) {
        // Nowhere clear: in front of what is in the way, where that is furthest from her
        const { place, hit } = best
        const k = (hit - CLEARANCE) / Math.hypot(place.x - head.x, place.y - head.y, place.z - head.z)
        wanted.set(head.x + (place.x - head.x) * k, head.y + (place.y - head.y) * k, head.z + (place.z - head.z) * k)
        lookAhead = best.lookAhead
      } else if (!clear) {
        wanted.set(head.x, head.y + OVERHEAD.up, head.z)
        lookAhead = OVERHEAD.lookAhead
      }
      const head3 = new THREE.Vector3(head.x, head.y, head.z)
      if (snap || wanted.distanceTo(head3) < camera.position.distanceTo(head3)) {
        camera.position.copy(wanted)
        ahead = lookAhead
      } else {
        const glide = 1 - Math.exp(-PLACE_RATE * dt)
        camera.position.lerp(wanted, glide)
        ahead += (lookAhead - ahead) * glide
      }
      camera.lookAt(focus.x - Math.sin(yaw) * ahead, focus.y + LOOK_HEIGHT, focus.z - Math.cos(yaw) * ahead)
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
  }
}
