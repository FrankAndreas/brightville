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
import { createFollowCamera } from './followCamera'
import { createView, walkDirection } from './view'
import { createSpeedWatch } from './quality'
import { START, heightAt } from './map'
import { WALK_SPEED as STROLL, startWalkers, stepWalker, townsfolkDress, walkerAt } from './walkers'

export interface CityOptions {
  canvas: HTMLCanvasElement
  intents: IntentSource
  doors: DoorDef[]
  /** Called when the nearest door changes */
  onNearDoor(id: string | null): void
  /** Interact pressed at an open door */
  onEnter(id: string): void
}

export interface City {
  /** The same doors with a new state: repaints them and changes which can be entered */
  setDoors(doors: DoorDef[]): void
  /** Her look and what she wears, on the character in the town */
  setDress(dress: Dress): void
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
  const props = buildProps(RAPIER, world, town.scene)
  const character = createCharacter(RAPIER, world, START, TRAMPOLINES)
  const blob = createBlob()
  town.scene.add(blob.object)

  // Townsfolk: wobblies like hers, in random looks, strolling the streets; without shadows, to spare the tablet
  let townsfolkSeed = 11
  const townsfolkRandom = () => ((townsfolkSeed = (townsfolkSeed * 16807) % 2147483647) / 2147483647)
  const townsfolk = startWalkers().map(walker => {
    const body = createBlob(townsfolkDress(townsfolkRandom))
    body.object.traverse(o => { o.castShadow = false })
    town.scene.add(body.object)
    return { walker, body }
  })
  function strollTownsfolk(her: { x: number; z: number }, dt: number) {
    for (const t of townsfolk) {
      t.walker = stepWalker(t.walker, her, dt)
      const p = walkerAt(t.walker)
      t.body.update({
        x: p.x, y: heightAt(p.x, p.z) + 0.6, z: p.z, heading: p.heading, speed: dt > 0 ? STROLL : 0, grounded: true,
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
    turning.step(intents, dt, at)
    // The keys walk relative to the view: up is always away from the camera
    const walk = walkDirection(turning.yaw, intents.moveX, intents.moveZ)
    const f = character.step({ ...intents, moveX: walk.x, moveZ: walk.z }, dt)
    if (dt > 0) world.step()
    if (f.event === 'bounce') props.bounce(f.x, f.z)
    if (import.meta.env.DEV) debug.record(f)
    at = { x: f.x, z: f.z }

    props.sync()
    props.update(dt)
    blob.update(f, dt)
    strollTownsfolk(f, dt)
    for (const door of town.doorVisuals) door.update(time)
    view.follow(f, dt, first, turning.yaw, blocked)
    town.followSun(f.x, f.z)
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
    if (near?.open && intents.interact) opts.onEnter(near.id)
  })
  loop.resume()

  return {
    setDress: blob.setDress,
    setDoors(next) {
      doors = next
      next.forEach((door, i) => town.doorVisuals[i]?.setState(door.open, door.locked ?? false))
    },
    pause: loop.pause,
    resume() {
      // Time spent inside a building isn't a slow frame
      speed.reset()
      loop.resume()
    },
    dispose() {
      loop.stop()
      window.removeEventListener('resize', resize)
      disposeScene(town.scene)
      renderer.dispose()
      world.free()
    },
  }
}
