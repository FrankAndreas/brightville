// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { createCharacter, type CharacterFrame } from './character'
import { TRAMPOLINE, buildProps } from './props'
import { GRAVITY, HALF_SIZE, buildTown } from './world'

// The real physics engine, without any drawing
const DT = 1 / 60
const still = { moveX: 0, moveZ: 0, jump: false }

function setup(start = { x: 0, z: 5 }) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
  buildTown(RAPIER, world, [])
  buildProps(RAPIER, world, new THREE.Scene())
  const character = createCharacter(RAPIER, world, start, TRAMPOLINE)
  const run = (seconds: number, intents = still, dt = DT): CharacterFrame[] => {
    const frames: CharacterFrame[] = []
    for (let t = 0; t < seconds; t += dt) {
      world.timestep = dt
      frames.push(character.step(intents, dt))
      world.step()
    }
    return frames
  }
  return { character, run }
}

const settle = (run: ReturnType<typeof setup>['run']) => run(0.5).at(-1)!
const events = (frames: CharacterFrame[]) => frames.map(f => f.event).filter(Boolean)

describe('character', () => {
  beforeAll(() => RAPIER.init())

  it('comes to rest on the ground', () => {
    const { run } = setup()
    const f = settle(run)
    expect(f.grounded).toBe(true)
    expect(f.y).toBeCloseTo(0.6, 1)
  })

  it('walks at about 4 metres per second', () => {
    const { run } = setup()
    const x0 = settle(run).x
    const f = run(2, { ...still, moveX: 1 }).at(-1)!
    expect(f.x - x0).toBeGreaterThan(6.5)
    expect(f.x - x0).toBeLessThan(8.2)
  })

  it('turns to face where it walks', () => {
    const { run } = setup()
    settle(run)
    const f = run(1, { ...still, moveX: 1 }).at(-1)!
    expect(f.heading).toBeCloseTo(Math.PI / 2, 1)
  })

  it('jumps about 1.2 metres and lands without tumbling', () => {
    const { run } = setup()
    const rest = settle(run).y
    const frames = [...run(DT, { ...still, jump: true }), ...run(2)]
    const peak = Math.max(...frames.map(f => f.y)) - rest
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.5)
    expect(events(frames)).toEqual(['jump', 'land'])
  })

  it('cannot jump again in the air', () => {
    const { run } = setup()
    settle(run)
    run(DT, { ...still, jump: true })
    run(0.2)
    expect(events(run(DT, { ...still, jump: true }))).toEqual([])
  })

  it.each([DT, 0.05])('stays inside the walls at %s s steps', dt => {
    const { run } = setup()
    settle(run)
    const f = run(12, { ...still, moveX: 1 }, dt).at(-1)!
    expect(f.x).toBeGreaterThan(HALF_SIZE - 2)
    expect(f.x).toBeLessThan(HALF_SIZE)
  })

  it('reports the speed it really moves at, not the speed it wants', () => {
    const { run } = setup()
    settle(run)
    const f = run(12, { ...still, moveX: 1 }).at(-1)!
    expect(f.speed).toBeLessThan(0.5)
  })

  it('never tumbles from jumping against a wall', () => {
    const { run } = setup()
    settle(run)
    run(8, { ...still, moveX: 1 })
    const seen: unknown[] = []
    for (let i = 0; i < 12; i++) {
      seen.push(...events(run(DT, { moveX: 1, moveZ: 0, jump: true })), ...events(run(1.1 + i * 0.013, { ...still, moveX: 1 })))
    }
    expect(seen).not.toContain('tumble')
    expect(seen).toContain('jump')
  })

  it('bounces on the trampoline, tumbles after the fall, stands up and walks on', () => {
    const { run } = setup({ x: TRAMPOLINE.x, z: TRAMPOLINE.z })
    // Dropped onto the pad: bounces without any key
    const bounce = run(1.5)
    expect(events(bounce)).toContain('bounce')
    expect(Math.max(...bounce.map(f => f.y))).toBeGreaterThan(3.5)

    // Steering off the pad ends in a long fall
    const fall = run(6, { ...still, moveX: 1 })
    expect(events(fall)).toContain('tumble')
    expect(fall.some(f => f.tumbling && f.rotation !== null)).toBe(true)
    expect(events(fall)).toContain('standUp')

    const end = fall.at(-1)!
    expect(end.tumbling).toBe(false)
    expect(end.rotation).toBeNull()
    expect(Math.abs(end.x)).toBeLessThan(HALF_SIZE)
    const later = run(1, { ...still, moveZ: 1 }).at(-1)!
    expect(later.z - end.z).toBeGreaterThan(2)
  })

  it('ignores the keys while tumbling', () => {
    const { run } = setup({ x: TRAMPOLINE.x, z: TRAMPOLINE.z })
    run(1.5)
    const frames = run(6, { ...still, moveX: 1, jump: true })
    const tumbling = frames.filter(f => f.tumbling)
    expect(tumbling.length).toBeGreaterThan(10)
    expect(events(tumbling)).toEqual(['tumble'])
  })
})
