import { describe, expect, it } from 'vitest'
import { bodyFromLandmarks, isBodyVisible } from './body'
import { standing } from './fixtures'

const landmarks = (n = 33) => Array.from({ length: n }, (_, i) => ({ x: i / 100, y: i / 50, visibility: 0.9 }))

describe('bodyFromLandmarks', () => {
  it('maps MediaPipe indices to joints', () => {
    const b = bodyFromLandmarks(landmarks())!
    expect(b.nose).toEqual({ x: 0, y: 0, visibility: 0.9 })
    expect(b.lShoulder.x).toBeCloseTo(0.11)
    expect(b.rShoulder.x).toBeCloseTo(0.12)
    expect(b.lWrist).toEqual({ x: 0.15, y: 0.3, visibility: 0.9 })
    expect(b.rHip.x).toBeCloseTo(0.24)
    expect(b.lKnee.x).toBeCloseTo(0.25)
    expect(b.rAnkle).toEqual({ x: 0.28, y: 0.56, visibility: 0.9 })
  })

  it('returns null for fewer than 29 landmarks', () => {
    expect(bodyFromLandmarks(landmarks(28))).toBeNull()
    expect(bodyFromLandmarks([])).toBeNull()
    expect(bodyFromLandmarks(landmarks(29))).not.toBeNull()
  })

  it('treats a missing visibility as 0', () => {
    const l = landmarks().map(({ x, y }) => ({ x, y }))
    expect(bodyFromLandmarks(l)!.nose.visibility).toBe(0)
  })

  it('stretches x by the picture shape so distances are the same in both directions', () => {
    const b = bodyFromLandmarks(landmarks(), 4 / 3)!
    expect(b.lWrist.x).toBeCloseTo(0.15 * 4 / 3)
    expect(b.lWrist.y).toBe(0.3)
  })
})

describe('isBodyVisible', () => {
  it('is true for a fully seen body', () => {
    expect(isBodyVisible(standing())).toBe(true)
  })

  it('is false when a knee is below 0.6', () => {
    const b = standing()
    b.rKnee.visibility = 0.59
    expect(isBodyVisible(b)).toBe(false)
  })

  it('does not need wrists or ankles', () => {
    const b = standing()
    b.lAnkle.visibility = b.rAnkle.visibility = b.lWrist.visibility = 0
    expect(isBodyVisible(b)).toBe(true)
  })
})
