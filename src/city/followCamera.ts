import * as THREE from 'three'

// From behind and above; the child turns it only with J/L/K/I or the turn buttons
const BACK = 9
const HEIGHT = 6
const LOOK_HEIGHT = 1
// The camera looks at a spot this far ahead of the character, not at the character: she stands in the lower part of
// the picture, and the buildings with their signs sit in the middle instead of under the Star bar (UX review)
const LOOK_AHEAD = 6
const FOLLOW_RATE = 5
// Up and down only slowly while she is in the air, so jumps don't shake the whole picture; on the ground (a hill) at
// the full rate, so she stays where she is in the picture
const AIR_RATE = 1
/** How far in front of a house or hill the camera stops when one is between it and her */
const CLEARANCE = 0.3
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
  return {
    camera,
    follow(target, dt, snap = false, yaw = 0, blocked) {
      const blend = snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt)
      const rise = snap ? 1 : 1 - Math.exp(-(target.grounded === false ? AIR_RATE : FOLLOW_RATE) * dt)
      focus.x += (target.x - focus.x) * blend
      focus.z += (target.z - focus.z) * blend
      focus.y += (target.y - REST_Y - focus.y) * rise
      const head = { x: focus.x, y: focus.y + LOOK_HEIGHT, z: focus.z }
      const want = { x: focus.x + Math.sin(yaw) * BACK, y: focus.y + HEIGHT, z: focus.z + Math.cos(yaw) * BACK }
      const hit = blocked?.(head, want) ?? null
      if (hit === null) {
        camera.position.set(want.x, want.y, want.z)
      } else {
        const length = Math.hypot(want.x - head.x, want.y - head.y, want.z - head.z)
        const k = Math.max(0, hit - CLEARANCE) / length
        camera.position.set(head.x + (want.x - head.x) * k, head.y + (want.y - head.y) * k, head.z + (want.z - head.z) * k)
      }
      camera.lookAt(focus.x - Math.sin(yaw) * LOOK_AHEAD, focus.y + LOOK_HEIGHT, focus.z - Math.cos(yaw) * LOOK_AHEAD)
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
  }
}
