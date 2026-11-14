// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { createCharacter } from './character'
import { HILLS, heightAt } from './map'
import { TRAMPOLINES } from './props'
import { GRAVITY, buildTown } from './world'

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
