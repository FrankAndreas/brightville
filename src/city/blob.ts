import * as THREE from 'three'
import { stepSpring, type Spring } from './spring'
import { WALK_SPEED } from './movement'
import { BODY_HEIGHT, type CharacterFrame } from './character'
import type { Dress } from '@/core/look'
import { dressParts } from './dress'

const BODY_COLOR = 0xff9a3c
const LIMB_COLOR = 0xf07f1b

/**
 * The visible character: a soft blob that squashes, leans and lets its arms
 * flop. All of the wobble is springs chasing what the physics body does.
 */
export interface Blob {
  object: THREE.Object3D
  update(f: CharacterFrame, dt: number): void
  /** Her look and what she wears: recolours the body and swaps hair, glasses and add-ons */
  setDress(dress: Dress): void
}

export function createBlob(dress?: Dress): Blob {
  const root = new THREE.Group()
  // Origin at the feet, so squash and lean pivot on the ground
  const feet = new THREE.Group()
  feet.position.y = -BODY_HEIGHT / 2
  root.add(feet)
  const lean = new THREE.Group()
  feet.add(lean)

  const skin = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.55 })
  const limb = new THREE.MeshStandardMaterial({ color: LIMB_COLOR, roughness: 0.6 })

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), skin)
  body.scale.set(1, 1.15, 1)
  body.position.y = 0.62
  body.castShadow = true
  lean.add(body)

  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
  const black = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 })
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), white)
    eye.position.set(side * 0.19, 0.82, 0.4)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), black)
    pupil.position.set(side * 0.19, 0.82, 0.51)
    lean.add(eye, pupil)
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI), black)
  smile.position.set(0, 0.62, 0.48)
  smile.rotation.z = Math.PI
  lean.add(smile)

  // Hair, glasses and add-ons ride on the leaning body, one group per place, so they wobble along (dress.ts)
  const worn = { head: new THREE.Group(), face: new THREE.Group(), neck: new THREE.Group(), torso: new THREE.Group(), back: new THREE.Group() }
  for (const group of Object.values(worn)) lean.add(group)

  function setDress(next: Dress) {
    const parts = dressParts(next)
    skin.color.setHex(parts.body)
    limb.color.setHex(parts.limbs)
    for (const [name, group] of Object.entries(worn)) {
      for (const old of [...group.children]) {
        group.remove(old)
        old.traverse(o => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          m.geometry.dispose()
          for (const mat of [m.material].flat()) mat.dispose()
        })
      }
      for (const part of parts[name as keyof typeof worn]) group.add(part)
    }
  }
  if (dress) setDress(dress)

  const arms = [-1, 1].map(side => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.46, 0.78, 0)
    shoulder.rotation.z = side * 0.5
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 6, 12), limb)
    arm.position.y = -0.24
    arm.castShadow = true
    shoulder.add(arm)
    lean.add(shoulder)
    return shoulder
  })

  const legs = [-1, 1].map(side => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), limb)
    foot.scale.set(1, 0.7, 1.35)
    foot.position.set(side * 0.2, 0.1, 0.05)
    foot.castShadow = true
    feet.add(foot)
    return foot
  })

  let squash: Spring = { value: 1, velocity: 0 }
  let tilt: Spring = { value: 0, velocity: 0 }
  const swing: Spring[] = [{ value: 0, velocity: 0 }, { value: 0, velocity: 0 }]
  let phase = 0

  return {
    object: root,
    setDress,
    update(f, dt) {
      root.position.set(f.x, f.y, f.z)
      if (f.rotation) root.quaternion.set(f.rotation.x, f.rotation.y, f.rotation.z, f.rotation.w)
      else root.rotation.set(0, f.heading, 0)

      if (f.event === 'jump') squash.velocity += 4
      if (f.event === 'bounce') squash.velocity += 7
      if (f.event === 'land' || f.event === 'tumble') squash.velocity -= Math.min(8, f.impact * 0.9)
      if (f.event === 'standUp') squash.velocity += 5

      const pace = Math.min(1, f.speed / WALK_SPEED)
      phase += dt * (4 + pace * 9)

      squash = stepSpring(squash, 1, 170, 9, dt)
      const s = Math.min(1.5, Math.max(0.55, squash.value))
      lean.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s))

      // Lean into the walk; loose damping makes it wobble on every start and stop
      tilt = stepSpring(tilt, f.tumbling ? 0 : pace * 0.22, 70, 5, dt)
      lean.rotation.x = tilt.value
      lean.rotation.z = f.grounded ? Math.sin(phase) * 0.07 * pace : 0

      arms.forEach((shoulder, i) => {
        const side = i === 0 ? -1 : 1
        // In the air the arms fly up; walking, they trail behind and flap
        const target = f.grounded || f.tumbling ? -pace * 0.5 + Math.sin(phase + (i ? Math.PI : 0)) * 0.7 * pace : -2.5
        swing[i] = stepSpring(swing[i], target, 55, 4.5, dt)
        shoulder.rotation.x = swing[i].value
        shoulder.rotation.z = side * (0.5 + (f.grounded ? 0 : 0.5))
      })

      legs.forEach((foot, i) => {
        const step = Math.sin(phase + (i ? Math.PI : 0))
        foot.position.z = 0.05 + step * 0.22 * pace
        foot.position.y = 0.1 + Math.max(0, -Math.cos(phase + (i ? Math.PI : 0))) * 0.12 * pace
      })
    },
  }
}
