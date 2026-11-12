import type RAPIER from '@dimforge/rapier3d-compat'
import type { Intents } from '@/input/intents'
import { JUMP_SPEED, desiredVelocity } from './movement'
import { TUMBLE_MS, shouldTumble } from './tumble'
import { GRAVITY } from './world'
import type { Trampoline } from './props'

type Rapier = typeof RAPIER

export const CAPSULE_RADIUS = 0.4
/** Feet to top of head */
export const BODY_HEIGHT = 1.2
const HALF_HEIGHT = BODY_HEIGHT / 2
/** Upward speed off the trampoline: about 4 m high */
const TRAMPOLINE_SPEED = Math.sqrt(2 * GRAVITY * 4)
// How quickly the ground speed follows the keys: soft starts and stops
const ACCELERATION = 9
const TURN_RATE = 10

/** What the visible body needs to know after each step. */
export interface CharacterFrame {
  x: number
  /** Height of the body's centre */
  y: number
  z: number
  /** Direction faced, radians around the vertical axis; 0 looks towards the camera */
  heading: number
  /** Ground speed, metres per second */
  speed: number
  grounded: boolean
  tumbling: boolean
  /** Free rotation while tumbling */
  rotation: { x: number; y: number; z: number; w: number } | null
  /** What happened in this step */
  event: 'jump' | 'land' | 'bounce' | 'tumble' | 'standUp' | null
  /** Speed of the landing, for the squash */
  impact: number
}

export interface Character {
  step(intents: Pick<Intents, 'moveX' | 'moveZ' | 'jump'>, dt: number): CharacterFrame
}

export function createCharacter(
  R: Rapier, world: RAPIER.World, start: { x: number; z: number }, trampoline: Trampoline,
): Character {
  const body = world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, HALF_HEIGHT + 0.05, start.z),
  )
  const collider = world.createCollider(
    R.ColliderDesc.capsule(HALF_HEIGHT - CAPSULE_RADIUS, CAPSULE_RADIUS).setRestitution(0.4).setDensity(0.6),
    body,
  )
  const controller = world.createCharacterController(0.02)
  controller.enableAutostep(0.35, 0.2, true)
  controller.enableSnapToGround(0.2)
  controller.setApplyImpulsesToDynamicBodies(true)
  controller.setCharacterMass(8)

  const v = { x: 0, y: 0, z: 0 }
  let heading = Math.PI
  let grounded = false
  let peakY = HALF_HEIGHT
  let tumbleLeftMs = 0

  const onTrampoline = (p: { x: number; y: number; z: number }) =>
    Math.hypot(p.x - trampoline.x, p.z - trampoline.z) < trampoline.radius * 0.85 &&
    p.y - HALF_HEIGHT < trampoline.top + 0.15

  function startTumble() {
    tumbleLeftMs = TUMBLE_MS
    body.setBodyType(R.RigidBodyType.Dynamic, true)
    body.setLinvel({ x: v.x, y: 3.5, z: v.z }, true)
    // Roll forwards over the direction of travel, or just over the nose
    const fx = Math.sin(heading)
    const fz = Math.cos(heading)
    body.setAngvel({ x: fz * 7, y: 1.5, z: -fx * 7 }, true)
  }

  function standUp() {
    const p = body.translation()
    body.setBodyType(R.RigidBodyType.KinematicPositionBased, true)
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    body.setTranslation({ x: p.x, y: Math.max(p.y, HALF_HEIGHT) + 0.1, z: p.z }, true)
    v.x = v.y = v.z = 0
    speed = 0
    peakY = p.y
    grounded = false
  }

  /** Ground speed actually achieved in the last step; lower than wanted when pushing against something */
  let speed = 0

  function frame(event: CharacterFrame['event'], impact = 0): CharacterFrame {
    const p = body.translation()
    const tumbling = tumbleLeftMs > 0
    return {
      x: p.x, y: p.y, z: p.z, heading, speed, grounded, tumbling,
      rotation: tumbling ? body.rotation() : null, event, impact,
    }
  }

  return {
    step(intents, dt) {
      if (dt <= 0) return frame(null)

      if (tumbleLeftMs > 0) {
        tumbleLeftMs -= dt * 1000
        if (tumbleLeftMs > 0) return frame(null)
        tumbleLeftMs = 0
        standUp()
        return frame('standUp')
      }

      const p = body.translation()
      // Fell out of the world somehow: back to the start, no drama
      if (p.y < -5) {
        body.setTranslation({ x: start.x, y: HALF_HEIGHT + 0.5, z: start.z }, true)
        v.x = v.y = v.z = 0
        return frame(null)
      }

      const want = desiredVelocity(intents)
      const blend = 1 - Math.exp(-ACCELERATION * dt)
      v.x += (want.x - v.x) * blend
      v.z += (want.z - v.z) * blend
      if (Math.hypot(want.x, want.z) > 0.1) {
        const target = Math.atan2(want.x, want.z)
        const diff = Math.atan2(Math.sin(target - heading), Math.cos(target - heading))
        heading += diff * (1 - Math.exp(-TURN_RATE * dt))
      }

      let event: CharacterFrame['event'] = null
      if (grounded && intents.jump) {
        v.y = JUMP_SPEED
        event = 'jump'
      }
      v.y -= GRAVITY * dt

      const before = { ...v }
      controller.computeColliderMovement(collider, { x: v.x * dt, y: v.y * dt, z: v.z * dt })
      const move = controller.computedMovement()
      body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z })
      const wasGrounded = grounded
      grounded = controller.computedGrounded()

      // Speed actually achieved; what was lost is the bump. Sideways bumps and
      // landings are judged separately, so a jump against a wall is not a crash.
      // (Walking is slower than TUMBLE_IMPACT_SPEED: bumps only tumble once
      // something faster exists, such as running or a scooter.)
      const got = { x: move.x / dt, y: move.y / dt, z: move.z / dt }
      speed = Math.hypot(got.x, got.z)
      const bump = Math.hypot(before.x - got.x, before.z - got.z)
      const landing = Math.abs(Math.min(0, before.y) - Math.min(0, got.y))
      const impact = Math.max(bump, landing)
      const next = { x: p.x + move.x, y: p.y + move.y, z: p.z + move.z }

      if (!grounded) {
        peakY = Math.max(peakY, next.y)
        if (shouldTumble(bump, 0)) {
          startTumble()
          return frame('tumble', bump)
        }
        // Bumped the head: stop rising
        if (v.y > 0 && got.y < v.y * 0.5) v.y = 0
        return frame(event)
      }

      const fall = peakY - next.y
      peakY = next.y
      // Standing on the trampoline always bounces: no key needed
      if (onTrampoline(next)) {
        v.y = TRAMPOLINE_SPEED
        grounded = false
        return frame('bounce', impact)
      }
      if (shouldTumble(bump, 0) || (!wasGrounded && shouldTumble(landing, fall))) {
        startTumble()
        return frame('tumble', impact)
      }
      if (event !== 'jump') v.y = 0
      return frame(!wasGrounded ? 'land' : event, impact)
    },
  }
}
