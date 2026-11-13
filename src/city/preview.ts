import * as THREE from 'three'
import type { Dress } from '@/core/look'
import { createBlob } from './blob'
import { BODY_HEIGHT, type CharacterFrame } from './character'

// Her character on its own, for the look screen, the shop and the wardrobe: the same blob as in the town (blob.ts),
// standing still and turning slowly, so what she sees here is what walks in the town.

const TURN_SPEED = 0.6 // radians per second

export interface Preview {
  setDress(dress: Dress): void
  dispose(): void
}

export function createPreview(canvas: HTMLCanvasElement): Preview {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a080, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(2, 4, 3)
  scene.add(sun)

  const blob = createBlob()
  scene.add(blob.object)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
  // Whole character in view, with room above for crowns and hats
  camera.position.set(0, 1.1, 4.2)
  camera.lookAt(0, 0.75, 0)

  const frame: CharacterFrame = {
    x: 0, y: BODY_HEIGHT / 2, z: 0, heading: 0, speed: 0, grounded: true, tumbling: false, rotation: null, event: null, impact: 0,
  }

  function resize() {
    const width = canvas.clientWidth || canvas.width
    const height = canvas.clientHeight || canvas.height
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }

  let last = performance.now()
  let raf = 0
  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    frame.heading += TURN_SPEED * dt
    blob.update(frame, dt)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(tick)

  return {
    setDress: blob.setDress,
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of [m.material].flat()) mat.dispose()
      })
      renderer.dispose()
    },
  }
}
