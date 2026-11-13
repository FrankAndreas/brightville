import { describe, expect, it } from 'vitest'
import { createFollowCamera } from './followCamera'

describe('createFollowCamera', () => {
  it('looks from behind and above, at the learning row when not turned', () => {
    const view = createFollowCamera()
    view.follow({ x: 2, y: 0, z: 3 }, 0, true)
    expect(view.camera.position.x).toBeCloseTo(2)
    expect(view.camera.position.y).toBeCloseTo(6)
    expect(view.camera.position.z).toBeCloseTo(12)
  })

  it('swings around the character when the view is turned', () => {
    const view = createFollowCamera()
    view.follow({ x: 0, y: 0, z: 0 }, 0, true, Math.PI / 2)
    expect(view.camera.position.x).toBeCloseTo(9)
    expect(view.camera.position.z).toBeCloseTo(0)
    // Looking at the character, so towards -x
    const ahead = view.camera.getWorldDirection(view.camera.position.clone())
    expect(ahead.x).toBeLessThan(-0.5)
  })
})
