import type { Intents } from '@/input/intents'
import type { CharacterFrame } from './character'
import { planRide, startRide, steer, type RideState, type RideTarget } from './ride'
import type { Point, WalkGrid } from './walkable'

/**
 * The longest frame a ride steers by: after a hidden tab, she must not be thrown past the point she steers at. The
 * town's loop already clamps frames to MAX_FRAME_S (frame.ts); this keeps the rider safe on its own.
 */
const MAX_STEER_DT = 0.1
/** Stuck: moved less than this … */
const STUCK_DISTANCE = 0.5
/** … in this many seconds, while the bike wants to go */
const STUCK_TIME = 1.5
/** She has moved this far since the ride was planned: plan it again from where she is */
const REPLAN_DISTANCE = 0.5

/** What the rider needs of her each frame */
export type RiderSpot = Pick<CharacterFrame, 'x' | 'z' | 'grounded' | 'tumbling' | 'event'>

/** How the bike moves her this frame: a world-space direction and a top speed for `Character.step` */
export interface RideControl {
  moveX: number
  moveZ: number
  jump: false
  speed: number
}

export interface Rider {
  /** Starts a ride (replacing one under way), from `at`; 'there' when she already is: then nothing starts */
  rideTo(target: RideTarget, at: Point): 'riding' | 'there'
  /** Ends a ride without a word (pausing the town) */
  cancel(): void
  /**
   * One frame: how the bike moves her, or null when there is no ride and her keys move her. Her own keys end a ride
   * as 'stopped' (that frame she stands still; the next one is hers), as does being stuck; reaching the end, 'arrived'.
   */
  step(intents: Intents, her: RiderSpot | null, dt: number): RideControl | null
  /** The bike is out and she sits on it */
  readonly onBike: boolean
  /** The heading to turn her (and the view behind her) to after arriving, until she uses any control; null otherwise */
  readonly facing: number | null
}

const interrupts = (i: Intents) => i.moveX !== 0 || i.moveZ !== 0 || i.jump || i.turn !== 0 || i.turnAround || i.lookHome

/** The bicycle ride in the town, frame by frame, around `steer` (ride.ts). Nothing here draws or moves anything. */
export function createRider(grid: () => WalkGrid, onEnd: (how: 'arrived' | 'stopped') => void): Rider {
  let target: RideTarget | null = null
  /** The planned way, while waiting for her to stand, and where she was when it was planned */
  let plan: Point[] | null = null
  const plannedAt = { x: 0, z: 0 }
  /** The ride under way; null while waiting for her to stand */
  let ride: RideState | null = null
  let facing: number | null = null
  // Where she was when she last got somewhere, and for how long she hasn't since
  const anchor = { x: 0, z: 0 }
  let stuckFor = 0
  // One control, filled in each frame
  const control: RideControl = { moveX: 0, moveZ: 0, jump: false, speed: 0 }

  const still = () => {
    control.moveX = control.moveZ = control.speed = 0
    return control
  }

  function makePlan(at: Point) {
    // A copy: the plan may start with the very point it is given, and `at` may be something that moves on
    plan = target && planRide({ x: at.x, z: at.z }, target, grid())
    plannedAt.x = at.x
    plannedAt.z = at.z
  }

  function end(how: 'arrived' | 'stopped') {
    if (how === 'arrived' && target) facing = target.face
    target = null
    plan = null
    ride = null
    onEnd(how)
    return still()
  }

  return {
    get onBike() {
      return ride !== null
    },
    get facing() {
      return facing
    },
    rideTo(next, at) {
      target = next
      ride = null
      facing = null
      makePlan(at)
      if (plan) return 'riding'
      // Already there: she just turns to face it
      target = null
      facing = next.face
      return 'there'
    },
    cancel() {
      target = null
      plan = null
      ride = null
    },
    step(intents, her, dt) {
      if (!target) {
        // Any of her controls ends the hold: walking turns her, and a turn key turns the view by hand again
        if (facing !== null && interrupts(intents)) facing = null
        return null
      }
      if (interrupts(intents)) return end('stopped')
      if (!her || dt <= 0) return still()

      // Waiting for her to stand (a bounce on a trampoline counts: she never stands still there)
      if (!ride) {
        if (her.tumbling || (!her.grounded && her.event !== 'bounce')) return still()
        if (Math.hypot(her.x - plannedAt.x, her.z - plannedAt.z) > REPLAN_DISTANCE) makePlan(her)
        if (!plan) return end('arrived')
        ride = startRide(plan)
        anchor.x = her.x
        anchor.z = her.z
        stuckFor = 0
      }
      // Knocked over mid-ride: the bike is gone until she stands, then rides on from wherever she landed
      if (her.tumbling) {
        ride = null
        makePlan(her)
        if (!plan) return end('arrived')
        return still()
      }

      const r = steer(ride, her, Math.min(dt, MAX_STEER_DT))
      ride = r.state
      if (r.arrived) return end('arrived')

      if (Math.hypot(her.x - anchor.x, her.z - anchor.z) > STUCK_DISTANCE) {
        anchor.x = her.x
        anchor.z = her.z
        stuckFor = 0
      } else if (r.speed > 0) {
        stuckFor += dt
        if (stuckFor > STUCK_TIME) return end('stopped')
      }
      control.moveX = r.dirX
      control.moveZ = r.dirZ
      control.speed = r.speed
      return control
    },
  }
}
