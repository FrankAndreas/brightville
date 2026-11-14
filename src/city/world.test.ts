// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { BUILDINGS, toDoors } from '@/buildings/registry'
import { createCharacter } from './character'
import { HILLS, heightAt } from './map'
import { TRAMPOLINES } from './props'
import { BUILDING_COLORS, GRAVITY, buildTown } from './world'

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
