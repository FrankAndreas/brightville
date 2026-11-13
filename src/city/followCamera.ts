import * as THREE from 'three'

// From behind and above; the child turns it only with J/L/K/I or the turn buttons
const BACK = 9
const HEIGHT = 6
const LOOK_HEIGHT = 1
// The camera looks at a spot this far ahead of the character, not at the character: she stands in the lower part of
// the picture, and the buildings with their signs sit in the middle instead of under the Star bar (UX review)
const LOOK_AHEAD = 6
const FOLLOW_RATE = 5

export function createFollowCamera(): {
  camera: THREE.PerspectiveCamera
  /** `yaw`: how far the view is turned (0 looks at the learning row); the camera sits at (sin, cos) behind */
  follow(target: { x: number; y: number; z: number }, dt: number, snap?: boolean, yaw?: number): void
  resize(width: number, height: number): void
} {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  const focus = new THREE.Vector3()
  return {
    camera,
    follow(target, dt, snap = false, yaw = 0) {
      const blend = snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt)
      // Follow height only loosely, so jumps don't shake the whole picture
      focus.x += (target.x - focus.x) * blend
      focus.z += (target.z - focus.z) * blend
      focus.y += (target.y * 0.5 - focus.y) * blend
      camera.position.set(focus.x + Math.sin(yaw) * BACK, focus.y + HEIGHT, focus.z + Math.cos(yaw) * BACK)
      camera.lookAt(focus.x - Math.sin(yaw) * LOOK_AHEAD, focus.y + LOOK_HEIGHT, focus.z - Math.cos(yaw) * LOOK_AHEAD)
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
  }
}
