import * as THREE from 'three'
import type { Dress } from '@/core/look'
import { createBlob } from './blob'
import { BODY_HEIGHT, type CharacterFrame } from './character'

// Her wobbly with wings, for the Flatterflug: the same blob as in the town (blob.ts), in her look and what she wears,
// seen from the front right as it flies to the right, with a pair of feathered wings on its back that beat after
// every flap and are held up while it glides. Drawn on its own small canvas, which the game moves over the sky.

/** How long the wings beat after a flap, and how fast */
const BEAT_MS = 380
const BEATS_PER_SECOND = 7
/** While hovering before the start, the wings beat slowly */
const HOVER_BEATS_PER_SECOND = 2

export interface Flyer {
  setDress(dress: Dress): void
  /** A tap: the wings beat */
  flap(): void
  /** Draws the next frame, leaning by `tiltRad` (negative: nose up) */
  draw(tiltRad: number, dtMs: number): void
  /** Slow beats while waiting for the first tap */
  hover(on: boolean): void
  /** Its canvas is `px` CSS pixels square */
  resize(px: number): void
  dispose(): void
  /** The two wing pivots, left then right; for tests */
  wings: THREE.Object3D[]
}

/** What the flyer wears: everything she wears, except on the back, where its wings go */
export function flyingDress(dress: Dress): Dress {
  const worn = { ...dress.worn }
  delete worn.back
  return { look: dress.look, worn }
}

function wingShape(): THREE.Shape {
  // A feathered wing, from the shoulder outwards: a round leading edge and three feather tips at the back
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.25, 0.32, 0.62, 0.36, 0.86, 0.22)
  s.quadraticCurveTo(0.8, 0.1, 0.7, 0.06)
  s.quadraticCurveTo(0.66, -0.04, 0.52, -0.06)
  s.quadraticCurveTo(0.46, -0.16, 0.32, -0.14)
  s.quadraticCurveTo(0.16, -0.12, 0, 0)
  return s
}

export function createFlyer(canvas: HTMLCanvasElement): Flyer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  try {
    return build(canvas, renderer)
  } catch (e) {
    // The context is taken: give it back, or the town's may be the one the browser drops
    renderer.dispose()
    renderer.forceContextLoss()
    throw e
  }
}

function build(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer): Flyer {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a080, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(2, 4, 3)
  scene.add(sun)

  // Leaning turns the whole wobbly about its middle, as seen on the screen
  const leaner = new THREE.Group()
  leaner.position.y = BODY_HEIGHT / 2
  scene.add(leaner)
  const blob = createBlob()
  blob.object.position.y = 0
  leaner.add(blob.object)

  // White feathers with a sky-blue edge, so they show against the sky
  const feather = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9a9a9a, roughness: 0.5, side: THREE.DoubleSide })
  const edge = new THREE.MeshStandardMaterial({ color: 0x7fb8e8, roughness: 0.6, side: THREE.DoubleSide })
  const geometry = new THREE.ShapeGeometry(wingShape(), 12)
  const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group()
    // On the back, at the shoulders
    pivot.position.set(side * 0.18, 0.3, -0.36)
    const wing = new THREE.Group()
    const face = new THREE.Mesh(geometry, feather)
    const rim = new THREE.Mesh(geometry, edge)
    rim.scale.setScalar(1.08)
    rim.position.set(-0.02, -0.01, -0.012)
    wing.add(rim, face)
    wing.scale.set(side * 1.6, 1.6, 1.6)
    // Out to the side, swept back a little, so both show beside the body
    wing.rotation.set(0, side * -0.45, side * -0.15)
    pivot.add(wing)
    blob.object.add(pivot)
    return pivot
  })

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  // Far enough for the spread wings: the canvas is wider than the wobbly by that much
  camera.position.set(0, 0.75, 7.1)
  camera.lookAt(0, 0.65, 0)

  const frame: CharacterFrame = {
    // Facing right, a little towards her
    x: 0, y: 0, z: 0, heading: 0.9, speed: 0, grounded: true, tumbling: false, rotation: null, event: null, impact: 0,
  }

  let beatLeft = 0
  let hovering = false
  let phase = 0

  function setWings(angle: number) {
    wings.forEach((pivot, i) => { pivot.rotation.z = (i === 0 ? -1 : 1) * angle })
  }

  function resize(px: number) {
    renderer.setSize(Math.max(1, px), Math.max(1, px), false)
    camera.aspect = 1
    camera.updateProjectionMatrix()
  }
  resize(canvas.clientWidth || 1)

  return {
    wings,
    setDress(dress) {
      blob.setDress(flyingDress(dress))
    },
    flap() {
      beatLeft = BEAT_MS
      // Each flap starts with the wings going down
      phase = 0
    },
    hover(on) {
      hovering = on
    },
    draw(tiltRad, dtMs) {
      const dt = dtMs / 1000
      if (beatLeft > 0) {
        beatLeft = Math.max(0, beatLeft - dtMs)
        phase += dt * BEATS_PER_SECOND * Math.PI * 2
        // Up high (0.9) to down low (-0.5)
        setWings(0.2 + Math.cos(phase) * 0.7)
      } else if (hovering) {
        phase += dt * HOVER_BEATS_PER_SECOND * Math.PI * 2
        setWings(0.35 + Math.cos(phase) * 0.35)
      } else {
        // Gliding: held up, still
        setWings(0.55)
      }
      leaner.rotation.z = -tiltRad
      frame.event = null
      blob.update(frame, dt)
      renderer.render(scene, camera)
    },
    resize,
    dispose() {
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of [m.material].flat()) mat.dispose()
      })
      renderer.dispose()
      // Give the WebGL context back now: browsers keep only a few, and drop the oldest when out
      renderer.forceContextLoss()
    },
  }
}
