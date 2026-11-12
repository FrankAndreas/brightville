import * as THREE from 'three'

// Fixed view from behind and above; the child never steers the camera
const OFFSET = new THREE.Vector3(0, 6, 9)
const LOOK_HEIGHT = 1
const FOLLOW_RATE = 5

export function createFollowCamera(): {
  camera: THREE.PerspectiveCamera
  follow(target: { x: number; y: number; z: number }, dt: number, snap?: boolean): void
  resize(width: number, height: number): void
} {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
  const focus = new THREE.Vector3()
  return {
    camera,
    follow(target, dt, snap = false) {
      const blend = snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt)
      // Follow height only loosely, so jumps don't shake the whole picture
      focus.x += (target.x - focus.x) * blend
      focus.z += (target.z - focus.z) * blend
      focus.y += (target.y * 0.5 - focus.y) * blend
      camera.position.copy(focus).add(OFFSET)
      camera.lookAt(focus.x, focus.y + LOOK_HEIGHT, focus.z)
    },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    },
  }
}
