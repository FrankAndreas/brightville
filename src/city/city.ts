import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { IntentSource } from '@/input/intents'
import { nearestDoor, type DoorDef } from './doors'
import { createLoop } from './loop'
import { GRAVITY, buildTown, cameraBlocker, disposeScene } from './world'
import { TRAMPOLINES, buildProps } from './props'
import { createCharacter, type CharacterFrame } from './character'
import { createBlob } from './blob'
import type { Dress } from '@/core/look'
import { createMountains } from './mountains'
import { createFollowCamera } from './followCamera'
import { createView, walkDirection } from './view'
import { createSpeedWatch } from './quality'
import { START, heightAt } from './map'
import { createAnimals } from './animals'
import { createBicycle, SADDLE_LIFT } from './bicycle'
import { createRider } from './rider'
import type { RideTarget } from './ride'
import type { WalkGrid } from './walkable'
import { rideGrid } from './nature'
import { WALK_SPEED as STROLL, startWalkers, stepWalker, townsfolkDress, turnToward, walkerAt } from './walkers'

export interface CityOptions {
  canvas: HTMLCanvasElement
  intents: IntentSource
  doors: DoorDef[]
  /** Called when the nearest door changes */
  onNearDoor(id: string | null): void
  /** Interact pressed at an open door */
  onEnter(id: string): void
  /**
   * A bicycle ride ended: at its target, or stopped by her keys or by being stuck (never by pause or stopRide). The app
   * doesn't use it today (the voice speaks when the ride starts, and the door when she arrives); the tests do, and it is
   * here for later use.
   */
  onRideEnd?(how: 'arrived' | 'stopped'): void
}

export interface City {
  /** The same doors with a new state: repaints them and changes which can be entered */
  setDoors(doors: DoorDef[]): void
  /** Her look and what she wears, on the character in the town */
  setDress(dress: Dress): void
  /**
   * Rides her there on the bicycle, along the streets (replacing a ride under way); 'there' when she already is.
   * Arriving never enters: she still does that herself.
   */
  rideTo(target: RideTarget): 'riding' | 'there'
  /** Ends a ride where she is, without onRideEnd */
  stopRide(): void
  /** Where she is */
  position(): { x: number; z: number }
  /** Also ends a ride, for good: resume() doesn't take it up again */
  pause(): void
  resume(): void
  dispose(): void
}

// Development aid: lets a script or the console see what the character does
const debug = {
  record(f: CharacterFrame) {
    const w = window as unknown as { __city?: { frame: CharacterFrame; events: string[]; maxY: number } }
    const d = (w.__city ??= { frame: f, events: [], maxY: 0 })
    d.frame = f
    d.maxY = Math.max(d.maxY, f.y)
    if (f.event) d.events.push(f.event)
    if (d.events.length > 200) d.events.shift()
  },
  /** What the last frame cost: draw calls, triangles, and the pixel ratio it was drawn at */
  drawn(calls: number, triangles: number, ratio: number) {
    const w = window as unknown as { __city?: Record<string, unknown> }
    if (w.__city) Object.assign(w.__city, { calls, triangles, ratio })
  },
}

export async function createCity(opts: CityOptions): Promise<City> {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })

  const renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true })
  const maxRatio = Math.min(window.devicePixelRatio || 1, 2)
  let pixelRatio = maxRatio
  renderer.setPixelRatio(pixelRatio)
  renderer.shadowMap.enabled = true

  const town = buildTown(RAPIER, world, opts.doors)
  const mountains = createMountains(town.scene)
  const props = buildProps(RAPIER, world, town.scene)
  const character = createCharacter(RAPIER, world, START, TRAMPOLINES)
  const blob = createBlob()
  town.scene.add(blob.object)
  const bicycle = createBicycle(blob.paint)
  town.scene.add(bicycle.object)
  // The walking grid for a ride's first stretch, trees and all: the doors' places never change, only whether they are open
  let grid: WalkGrid | null = null
  const rider = createRider(() => (grid ??= rideGrid(opts.doors)), how => opts.onRideEnd?.(how))

  // Townsfolk: simpler wobblies than hers (createBlob 'low': fewer segments, no shadows), in random looks, strolling
  let townsfolkSeed = 11
  const townsfolkRandom = () => ((townsfolkSeed = (townsfolkSeed * 16807) % 2147483647) / 2147483647)
  const townsfolk = startWalkers().map(walker => {
    const body = createBlob(townsfolkDress(townsfolkRandom), 'low')
    town.scene.add(body.object)
    return { walker, body, facing: walkerAt(walker).heading }
  })
  const animals = createAnimals(town.scene, opts.doors)

  function strollTownsfolk(her: { x: number; z: number }, dt: number) {
    for (const t of townsfolk) {
      t.walker = stepWalker(t.walker, her, dt)
      const p = walkerAt(t.walker)
      t.facing = turnToward(t.facing, p.heading, dt)
      t.body.update({
        x: p.x, y: heightAt(p.x, p.z) + 0.6, z: p.z, heading: t.facing, speed: dt > 0 && !t.walker.still ? STROLL : 0, grounded: true,
        tumbling: false, rotation: null, event: null, impact: 0,
      }, dt)
    }
  }
  const view = createFollowCamera()
  const turning = createView()
  const blocked = cameraBlocker(RAPIER, world)

  const resize = () => {
    const width = opts.canvas.clientWidth || window.innerWidth
    const height = opts.canvas.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    view.resize(width, height)
  }
  resize()
  window.addEventListener('resize', resize)

  let doors = opts.doors
  let time = 0
  let nearId: string | null = null
  let first = true
  let at = { x: START.x, z: START.z }
  let last: CharacterFrame | null = null
  // On the bike she sits a little higher and doesn't walk: one frame, filled in each time
  const sitting: CharacterFrame = {
    x: 0, y: 0, z: 0, heading: 0, speed: 0, grounded: true, tumbling: false, rotation: null, event: null, impact: 0,
  }
  // Frame times over two seconds: slow ones make the picture a little less sharp (quality.ts)
  const speed = createSpeedWatch(maxRatio)
  function watchSpeed() {
    const next = speed.frame(performance.now())
    if (next === null) return
    pixelRatio = next
    renderer.setPixelRatio(pixelRatio)
    resize()
  }

  const loop = createLoop(opts.intents, (intents, dt) => {
    time += dt
    world.timestep = dt || 1 / 60
    // On the bicycle the ride steers her in the town's own directions, and the view swings round behind her
    const ride = rider.step(intents, last, dt)
    let f: CharacterFrame
    if (ride) {
      // Towards the way the bike goes, not her standing heading, which lags behind it (a still control has no way)
      if (ride.speed > 0) turning.behind(Math.atan2(ride.moveX, ride.moveZ), dt)
      else if (last) turning.behind(last.heading, dt)
      f = character.step(ride, dt, ride.speed)
    } else {
      // After arriving she turns to the stop's way and the view swings round behind her, until she uses a control
      // (rider.step ran first: a turn key this frame already ended the hold)
      if (rider.facing !== null) turning.behind(rider.facing, dt)
      else turning.step(intents, dt, at)
      // The keys walk relative to the view: up is always away from the camera
      const walk = walkDirection(turning.yaw, intents.moveX, intents.moveZ)
      f = character.step({ ...intents, moveX: walk.x, moveZ: walk.z }, dt, undefined, rider.facing)
    }
    last = f
    if (dt > 0) world.step()
    if (f.event === 'bounce') props.bounce(f.x, f.z)
    if (import.meta.env.DEV) debug.record(f)
    at = { x: f.x, z: f.z }

    props.sync()
    props.update(dt)
    // She rises onto the saddle as the bike grows in under her, and steps down as it shrinks away
    bicycle.update(f, rider.onBike, f.speed, dt)
    if (bicycle.presence > 0) {
      Object.assign(sitting, f)
      sitting.y += SADDLE_LIFT * bicycle.presence
      if (rider.onBike) sitting.speed = 0
      blob.update(sitting, dt)
    } else {
      blob.update(f, dt)
    }
    strollTownsfolk(f, dt)
    animals.update(time, dt, f)
    for (const door of town.doorVisuals) door.update(time)
    town.update(time)
    view.follow(f, dt, first, turning.yaw, blocked)
    town.followSun(f.x, f.z)
    mountains.follow(view.camera.position.x, view.camera.position.z)
    first = false
    renderer.render(town.scene, view.camera)
    if (import.meta.env.DEV) debug.drawn(renderer.info.render.calls, renderer.info.render.triangles, pixelRatio)
    // Only while the town is shown: a paused loop doesn't count as slow
    if (dt > 0) watchSpeed()

    const near = f.tumbling ? null : nearestDoor(f, doors)
    if ((near?.id ?? null) !== nearId) {
      nearId = near?.id ?? null
      opts.onNearDoor(nearId)
    }
    // Only her own press enters, never a ride passing or arriving
    if (near?.open && intents.interact && !ride) opts.onEnter(near.id)
  })
  loop.resume()

  return {
    setDress: blob.setDress,
    setDoors(next) {
      doors = next
      next.forEach((door, i) => town.doorVisuals[i]?.setState(door.open, door.locked ?? false))
    },
    rideTo: target => rider.rideTo(target, at),
    stopRide: rider.cancel,
    position: () => ({ x: at.x, z: at.z }),
    pause() {
      rider.cancel()
      loop.pause()
    },
    resume() {
      // Time spent inside a building isn't a slow frame
      speed.reset()
      loop.resume()
    },
    dispose() {
      loop.stop()
      window.removeEventListener('resize', resize)
      mountains.dispose()
      disposeScene(town.scene)
      renderer.dispose()
      world.free()
    },
  }
}
