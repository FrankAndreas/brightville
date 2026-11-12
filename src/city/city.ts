import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { IntentSource } from '@/input/intents'
import { nearestDoor, type DoorDef } from './doors'
import { createLoop } from './loop'
import { GRAVITY, buildTown } from './world'
import { TRAMPOLINE, buildProps } from './props'
import { createCharacter, type CharacterFrame } from './character'
import { createBlob } from './blob'
import { createFollowCamera } from './followCamera'

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
  pause(): void
  resume(): void
  dispose(): void
}

const START = { x: 0, z: 5 }

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
}

export async function createCity(opts: CityOptions): Promise<City> {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })

  const renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true

  const town = buildTown(RAPIER, world, opts.doors)
  const props = buildProps(RAPIER, world, town.scene)
  const character = createCharacter(RAPIER, world, START, TRAMPOLINE)
  const blob = createBlob()
  town.scene.add(blob.object)
  const view = createFollowCamera()

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

  const loop = createLoop(opts.intents, (intents, dt) => {
    time += dt
    world.timestep = dt || 1 / 60
    const f = character.step(intents, dt)
    if (dt > 0) world.step()
    if (f.event === 'bounce') props.bounce()
    if (import.meta.env.DEV) debug.record(f)

    props.sync()
    props.update(dt)
    blob.update(f, dt)
    for (const door of town.doorVisuals) door.update(time)
    view.follow(f, dt, first)
    first = false
    renderer.render(town.scene, view.camera)

    const near = f.tumbling ? null : nearestDoor(f, doors)
    if ((near?.id ?? null) !== nearId) {
      nearId = near?.id ?? null
      opts.onNearDoor(nearId)
    }
    if (near?.open && intents.interact) opts.onEnter(near.id)
  })
  loop.resume()

  return {
    setDoors(next) {
      doors = next
      next.forEach((door, i) => town.doorVisuals[i]?.setState(door.open, door.locked ?? false))
    },
    pause: loop.pause,
    resume: loop.resume,
    dispose() {
      loop.stop()
      window.removeEventListener('resize', resize)
      town.scene.traverse(object => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        for (const m of Array.isArray(material) ? material : material ? [material] : []) {
          (m as THREE.MeshBasicMaterial).map?.dispose()
          m.dispose()
        }
      })
      renderer.dispose()
      world.free()
    },
  }
}
