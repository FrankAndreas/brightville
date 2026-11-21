// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { createCharacter, type CharacterFrame } from './character'
import { BLOCKS, TRAMPOLINE, TRAMPOLINES, buildProps } from './props'
import { GRAVITY, buildTown } from './world'
import type { DoorDef } from './doors'
import { BUILDINGS, toDoors } from '@/buildings/registry'
import { NATURE_SEED, SOLID_KINDS, placeNature } from './nature'
import { HILLS, JETTY, LAKE, TOWN_HALF, heightAt, inLake } from './map'

// The real physics engine, without any drawing
const DT = 1 / 60
const still = { moveX: 0, moveZ: 0, jump: false }

function setup(start = { x: 0, z: 5 }, doors: DoorDef[] = []) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
  buildTown(RAPIER, world, doors)
  buildProps(RAPIER, world, new THREE.Scene())
  const character = createCharacter(RAPIER, world, start, TRAMPOLINES)
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

  it('goes at the top speed it is given, as on the bicycle', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0))
    const character = createCharacter(RAPIER, world, { x: -40, z: 0 }, [])
    const step = (seconds: number, intents = still, speed?: number, face?: number | null) => {
      let f!: CharacterFrame
      for (let t = 0; t < seconds; t += DT) {
        world.timestep = DT
        f = character.step(intents, DT, speed, face)
        world.step()
      }
      return f
    }
    step(0.5)
    expect(step(1, { ...still, moveX: 1 }, 12).speed).toBeGreaterThan(11.5)
    // Standing, she turns to the heading she is given
    const f = step(1, still, undefined, -Math.PI / 2)
    expect(f.speed).toBeLessThan(0.1)
    expect(Math.cos(f.heading + Math.PI / 2)).toBeCloseTo(1, 3)
  })

  it('is never knocked over riding into a wall at the bicycle\'s speed, nor slowing down after it', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2, 10).setTranslation(-30, 2, 0))
    const character = createCharacter(RAPIER, world, { x: -40, z: 0 }, [])
    const frames: CharacterFrame[] = []
    for (let t = 0; t < 2; t += DT) {
      world.timestep = DT
      frames.push(character.step({ ...still, moveX: 1 }, DT, t < 1.5 ? 12 : undefined))
      world.step()
    }
    expect(frames.at(-1)!.x).toBeGreaterThan(-31)
    expect(events(frames)).not.toContain('tumble')
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

  it.each([DT, 0.05])('stops at the town\'s edge at %s s steps', dt => {
    // Along the avenue to the left, where nothing stands in the way (the one to the right goes on to the workshop)
    const { run } = setup({ x: 0, z: 0 })
    settle(run)
    const f = run(18, { ...still, moveX: -1 }, dt).at(-1)!
    expect(f.x).toBeLessThan(-(TOWN_HALF - 2))
    expect(f.x).toBeGreaterThan(-TOWN_HALF)
  })

  it('reports the speed it really moves at, not the speed it wants', () => {
    const { run } = setup({ x: 0, z: 0 })
    settle(run)
    const f = run(18, { ...still, moveX: -1 }).at(-1)!
    expect(f.speed).toBeLessThan(0.5)
  })

  it('never tumbles from jumping against a wall', () => {
    const { run } = setup({ x: 0, z: 0 })
    settle(run)
    run(16, { ...still, moveX: -1 })
    const seen: unknown[] = []
    for (let i = 0; i < 12; i++) {
      seen.push(...events(run(DT, { moveX: -1, moveZ: 0, jump: true })), ...events(run(1.1 + i * 0.013, { ...still, moveX: -1 })))
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
    expect(Math.abs(end.x)).toBeLessThan(TOWN_HALF)
    const later = run(1, { ...still, moveZ: 1 }).at(-1)!
    expect(later.z - end.z).toBeGreaterThan(2)
  })

  it('is thrown higher by the big trampoline than by the small one', () => {
    const peak = (t: (typeof TRAMPOLINES)[number]) => {
      const { run } = setup({ x: t.x, z: t.z })
      return Math.max(...run(4).map(f => f.y))
    }
    const sizes = [...TRAMPOLINES].sort((a, b) => a.height - b.height)
    const low = peak(sizes[0])
    const high = peak(sizes[sizes.length - 1])
    expect(high).toBeGreaterThan(6)
    expect(low).toBeLessThan(4)
  })

  it('climbs the staircase to the platform by jumping from step to step', () => {
    const steps = BLOCKS.filter(b => b.kind === 'step').sort((a, b) => a.h - b.h)
    const top = BLOCKS.find(b => b.kind === 'platform')!
    const first = steps[0]
    // Lined up along z, in front of the first step; `dir` is the way the staircase climbs
    const dir = Math.sign(top.z - first.z)
    const { run } = setup({ x: first.x, z: first.z - dir * first.d })
    settle(run)
    let best = 0
    for (let i = 0; i < 40; i++) {
      run(DT, { ...still, moveZ: dir, jump: true })
      const f = run(0.45, { ...still, moveZ: 0.6 * dir }).at(-1)!
      best = Math.max(best, f.y)
      if (dir * (f.z - top.z) > -top.d / 2 + 0.5) break
    }
    // Standing on the platform: its height plus half the body
    expect(best).toBeGreaterThan(top.h + 0.4)
  })

  it('cannot walk through a hurdle without jumping', () => {
    const hurdle = BLOCKS.find(b => b.kind === 'hurdle')!
    const { run } = setup({ x: hurdle.x, z: hurdle.z - 2 })
    settle(run)
    const f = run(2, { ...still, moveZ: 1 }).at(-1)!
    expect(f.z).toBeLessThan(hurdle.z)
  })

  it('ignores the keys while tumbling', () => {
    const { run } = setup({ x: TRAMPOLINE.x, z: TRAMPOLINE.z })
    run(1.5)
    const frames = run(6, { ...still, moveX: 1, jump: true })
    const tumbling = frames.filter(f => f.tumbling)
    expect(tumbling.length).toBeGreaterThan(10)
    expect(events(tumbling)).toEqual(['tumble'])
  })

  it('walks over the highest hill and down without tumbling', () => {
    const hill = [...HILLS].sort((a, b) => b.height - a.height)[0]
    // Over the top, but between the trees: the first line across with no trunk within 1.5 m
    const trunks = placeNature(NATURE_SEED, []).filter(i => SOLID_KINDS.has(i.kind))
    const z = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(dz => hill.z + dz).find(z =>
      !trunks.some(t => Math.abs(t.z - z) < 1.5 && t.x > hill.x - hill.radius - 2 && t.x < hill.x + hill.radius + 2))!
    expect(z).toBeDefined()
    const { run } = setup({ x: hill.x - hill.radius - 1, z })
    settle(run)
    const frames = run(9, { ...still, moveX: 1 })
    expect(frames.at(-1)!.x).toBeGreaterThan(hill.x + hill.radius)
    expect(Math.max(...frames.map(f => f.y))).toBeGreaterThan(hill.height)
    expect(events(frames)).toEqual([])
    expect(frames.filter(f => f.grounded).length / frames.length).toBeGreaterThanOrEqual(0.9)
  })

  it('stops at the lake', () => {
    // From the ring road behind the lake, straight at its middle
    const { run } = setup({ x: LAKE.x, z: LAKE.z + LAKE.rz + 5 })
    settle(run)
    const f = run(5, { ...still, moveZ: -1 }).at(-1)!
    expect(inLake(f.x, f.z)).toBe(false)
    expect(f.z).toBeGreaterThan(LAKE.z + LAKE.rz - 0.5)
  })

  it('walks to the end of the jetty, and no further', () => {
    const { run } = setup({ x: (JETTY.minX + JETTY.maxX) / 2, z: JETTY.minZ - 1 })
    settle(run)
    const f = run(6, { ...still, moveZ: 1 }).at(-1)!
    expect(f.z).toBeGreaterThan(JETTY.maxZ - 1.5)
    expect(f.z).toBeLessThan(JETTY.maxZ)
  })

  it('a bounce on every trampoline lands her on walkable ground, with every building standing', () => {
    // The signs draw on a canvas: none here, so they stay blank
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    for (const t of TRAMPOLINES) {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4
        const { run } = setup({ x: t.x, z: t.z }, doors)
        run(1)
        run(2.5, { ...still, moveX: Math.cos(a), moveZ: Math.sin(a) })
        const f = run(3).at(-1)!
        const where = `trampoline ${t.x},${t.z} towards ${k * 45}°`
        expect(inLake(f.x, f.z), where).toBe(false)
        expect(Math.max(Math.abs(f.x), Math.abs(f.z)), where).toBeLessThan(TOWN_HALF)
        expect(f.y, where).toBeLessThan(heightAt(f.x, f.z) + 1.5)
      }
    }
    vi.unstubAllGlobals()
    // 24 whole towns with every house: slow next to the rest of the suite
  }, 30_000)
})
