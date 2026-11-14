// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { BUILDINGS, toDoors } from '@/buildings/registry'
import { createCharacter } from './character'
import { HILLS, LAKE, TOWN_HALF, heightAt } from './map'
import { TRAMPOLINES } from './props'
import { BUILDING_COLORS, GRAVITY, buildTown, cameraBlocker } from './world'

describe('the town', () => {
  beforeAll(() => RAPIER.init())

  it('rests her on a hill at the height of the ground there', () => {
    for (const hill of HILLS) {
      const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
      buildTown(RAPIER, world, [])
      // A little off the top, so a mirrored heightfield would show
      const x = hill.x + hill.radius / 3
      const z = hill.z - hill.radius / 4
      const character = createCharacter(RAPIER, world, { x, z }, TRAMPOLINES)
      world.timestep = 1 / 60
      let f = character.step({ moveX: 0, moveZ: 0, jump: false }, 1 / 60)
      for (let i = 0; i < 120; i++) {
        f = character.step({ moveX: 0, moveZ: 0, jump: false }, 1 / 60)
        world.step()
      }
      expect(f.y - 0.6, `hill at ${hill.x},${hill.z}`).toBeCloseTo(heightAt(x, z), 0)
      expect(Math.abs(f.y - 0.6 - heightAt(x, z))).toBeLessThan(0.15)
    }
  })
})

describe('the door buildings', () => {
  beforeAll(() => RAPIER.init())

  const OLD_WALLS = [0xd9c8ff, 0xfde4a8, 0xbde0fe, 0xc8f0d0, 0xf3dfc1, 0xd6ecff, 0xfff1b8, 0xcdeeea, 0xffc8dd, 0xe5d4ff, 0xffd6e8, 0x3d3d5c]
  const hue = (hex: number) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).h * 360

  it('gives every door building its own colour pair, close to the one it had', () => {
    expect(BUILDING_COLORS).toHaveLength(BUILDINGS.length)
    expect(new Set(BUILDING_COLORS.map(([w, r]) => `${w}/${r}`)).size).toBe(BUILDINGS.length)
    BUILDING_COLORS.forEach(([wall], i) => {
      const d = Math.abs(hue(wall) - hue(OLD_WALLS[i % OLD_WALLS.length]))
      expect(Math.min(d, 360 - d), BUILDINGS[i].id).toBeLessThanOrEqual(40)
    })
  })

  it('shows each sign as a picture above its door, seen from every side', () => {
    // No drawing here: a canvas without a context leaves the sign blank
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    const { scene } = buildTown(RAPIER, new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 }), doors)
    const sprites: THREE.Sprite[] = []
    scene.traverse(o => { if ((o as THREE.Sprite).isSprite) sprites.push(o as THREE.Sprite) })
    expect(sprites).toHaveLength(doors.length)
    for (const door of doors) {
      const sign = sprites.find(s => Math.hypot(s.position.x - door.x, s.position.z - door.z) <= 1)
      expect(sign, door.id).toBeDefined()
      expect(sign!.position.y, door.id).toBeGreaterThan(5)
    }
    vi.unstubAllGlobals()
  })
})

describe('what the camera sees through', () => {
  beforeAll(() => RAPIER.init())

  function town() {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const built = buildTown(RAPIER, world, doors)
    vi.unstubAllGlobals()
    world.step()
    return { world, built, blocked: cameraBlocker(RAPIER, world) }
  }

  it('is stopped by a house and by a hill', () => {
    const { blocked } = town()
    // Through the school, from the street to behind it
    const school = BUILDINGS.find(b => b.id === 'school')!.door
    const d = blocked({ x: school.x - 1, y: 2, z: school.z }, { x: school.x + 9, y: 2, z: school.z })
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(1)
    expect(d!).toBeLessThan(3)
    const hill = [...HILLS].sort((a, b) => b.height - a.height)[0]
    expect(blocked({ x: hill.x - hill.radius - 2, y: 1, z: hill.z }, { x: hill.x, y: 1, z: hill.z })).not.toBeNull()
  })

  it('looks through the invisible walls round the lake and the town', () => {
    const { blocked } = town()
    expect(blocked({ x: LAKE.x, y: 2, z: LAKE.z + LAKE.rz + 3 }, { x: LAKE.x, y: 2, z: LAKE.z })).toBeNull()
    expect(blocked({ x: 0, y: 3, z: TOWN_HALF - 3 }, { x: 0, y: 3, z: TOWN_HALF + 5 })).toBeNull()
  })

  it('moves the sun\'s shadows with her', () => {
    const { built } = town()
    built.followSun(30, -20)
    expect(built.sun.target.position.x).toBeCloseTo(30, 0)
    expect(built.sun.target.position.z).toBeCloseTo(-20, 0)
    expect(built.sun.position.x - built.sun.target.position.x).toBeCloseTo(14, 0)
  })
})
