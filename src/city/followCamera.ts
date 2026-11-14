import * as THREE from 'three'

// From behind and above; the child turns it only with J/L/K/I or the turn buttons
const BACK = 9
const HEIGHT = 6
const LOOK_HEIGHT = 1
// The camera looks at a spot this far ahead of the character, not at the character: she stands in the lower part of
// the picture, and the buildings with their signs sit in the middle instead of under the Star bar (UX review)
const LOOK_AHEAD = 6
const FOLLOW_RATE = 5
/** How quickly the camera glides to another place while she stays in sight (it jumps when she is hidden) */
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
type Place = { up: number; back: number; lookAhead: number }

/** The first of PLACES from which nothing hides her; else in front of what is in the way; else straight above her */
function bestPlace(head: Vec3, at: (p: Place) => Vec3, blocked?: (from: Vec3, to: Vec3) => number | null): Place {
  let best: { p: Place; hit: number } | null = null
  for (const p of PLACES) {
    const hit = blocked?.(head, at(p)) ?? null
    if (hit === null) return p
    if (!best || hit > best.hit) best = { p, hit }
  }
  const length = Math.hypot(best!.p.back, best!.p.up - LOOK_HEIGHT)
  const k = (best!.hit - CLEARANCE) / length
  if (best!.hit - CLEARANCE >= MIN_BACK) {
    return { up: LOOK_HEIGHT + (best!.p.up - LOOK_HEIGHT) * k, back: best!.p.back * k, lookAhead: best!.p.lookAhead }
  }
  return { up: LOOK_HEIGHT + OVERHEAD.up, back: 0, lookAhead: OVERHEAD.lookAhead }
}

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
  /**
   * Where the camera is, in its own terms: how high above her feet, how far behind her (along the view's turn) and how
   * far ahead it looks. It glides in these, so it always stays on the circle around her and turns with the view.
   */
  const place: Place = { ...PLACES[0] }
  return {
    camera,
    follow(target, dt, snap = false, yaw = 0, blocked) {
      const blend = snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt)
      const rise = snap ? 1 : 1 - Math.exp(-(target.grounded === false ? AIR_RATE : FOLLOW_RATE) * dt)
      focus.x += (target.x - focus.x) * blend
      focus.z += (target.z - focus.z) * blend
      focus.y += (target.y - REST_Y - focus.y) * rise
      const head = { x: focus.x, y: focus.y + LOOK_HEIGHT, z: focus.z }
      const at = (p: Place): Vec3 => ({ x: focus.x + Math.sin(yaw) * p.back, y: focus.y + p.up, z: focus.z + Math.cos(yaw) * p.back })

      const goal = bestPlace(head, at, blocked)
      // Hidden where it is now: straight to where she is seen. Otherwise it glides, also back down once a house is gone
      const hidden = blocked?.(head, at(place)) != null
      const glide = snap || hidden ? 1 : 1 - Math.exp(-PLACE_RATE * dt)
      place.up += (goal.up - place.up) * glide
      place.back += (goal.back - place.back) * glide
      place.lookAhead += (goal.lookAhead - place.lookAhead) * glide

      const p = at(place)
      camera.position.set(p.x, p.y, p.z)
      camera.lookAt(focus.x - Math.sin(yaw) * place.lookAhead, focus.y + LOOK_HEIGHT, focus.z - Math.cos(yaw) * place.lookAhead)
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
  }
}
