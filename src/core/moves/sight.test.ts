import { describe, expect, it } from 'vitest'
import { standing } from '@/core/pose/fixtures'
import { ARMS_T, ARMS_UP, BEND, HANDS_ON_HEAD, SQUAT, changed, unseen } from './fixtures'
import { armDown, armUp } from './arms'
import { LOST_AFTER_MS, SAY_AGAIN_MS, SETTLE_MS, createSight, upperBodySeen } from './sight'

const UNIT = 0.16

describe('upperBodySeen', () => {
  it('needs the nose and both shoulders, nothing below', () => {
    expect(upperBodySeen(standing())).toBe(true)
    expect(upperBodySeen(unseen(['lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle'], standing()))).toBe(true)
    expect(upperBodySeen(unseen(['rShoulder'], standing()))).toBe(false)
    expect(upperBodySeen(unseen(['nose'], standing()))).toBe(false)
  })
})

describe('createSight', () => {
  const frames = (sight: ReturnType<typeof createSight>, body: Parameters<typeof sight.update>[0], ms: number) => {
    let last = sight.update(body, 0)
    for (let t = 0; t < ms; t += 50) last = sight.update(body, 50)
    return last
  }

  it('is ready once the upper body was seen for a second, with her standing height and shoulder width', () => {
    const sight = createSight()
    expect(frames(sight, standing(), SETTLE_MS - 100).ready).toBe(false)
    const now = frames(sight, standing(), 200)
    expect(now).toMatchObject({ seen: true, ready: true, lost: false })
    expect(now.standY).toBeCloseTo(0.3)
    expect(now.unit).toBeCloseTo(UNIT)
  })

  it('becomes lost after a moment unseen, says so once, and again only after a while', () => {
    const sight = createSight()
    frames(sight, standing(), SETTLE_MS + 100)
    // A short gap is not lost: the tracker drops single frames
    expect(frames(sight, null, LOST_AFTER_MS - 200)).toMatchObject({ seen: false, ready: true, lost: false, sayLost: false })
    const lostAt = sight.update(null, 250)
    expect(lostAt).toMatchObject({ lost: true, ready: false, sayLost: true })
    expect(frames(sight, null, SAY_AGAIN_MS - 300).sayLost).toBe(false)
    let said = false
    for (let t = 0; t < 600; t += 50) said ||= sight.update(null, 50).sayLost
    expect(said).toBe(true)
  })

  it('at the start, waits a while before saying she is not seen, so the first instruction is heard out', () => {
    const sight = createSight()
    let said = false
    let lost = false
    for (let t = 0; t < LOST_AFTER_MS + SAY_AGAIN_MS - 1000; t += 50) {
      const now = sight.update(null, 50)
      said ||= now.sayLost
      lost ||= now.lost
    }
    expect(lost).toBe(true)
    expect(said).toBe(false)
    for (let t = 0; t < 1000; t += 50) said ||= sight.update(null, 50).sayLost
    expect(said).toBe(true)
  })

  it('learns her standing height again after being lost', () => {
    const sight = createSight()
    frames(sight, standing(), SETTLE_MS + 100)
    frames(sight, null, LOST_AFTER_MS + 100)
    // Back, but a step closer: shoulders lower in the picture
    const closer = changed({ lShoulder: [0.6, 0.4], rShoulder: [0.4, 0.4], nose: [0.5, 0.28] })
    expect(frames(sight, closer, SETTLE_MS - 100).ready).toBe(false)
    const now = frames(sight, closer, 200)
    expect(now.ready).toBe(true)
    expect(now.standY).toBeCloseTo(0.4)
  })

  it('does not take a squat for her new standing height', () => {
    const sight = createSight()
    frames(sight, standing(), SETTLE_MS + 100)
    expect(frames(sight, SQUAT, 5000).standY).toBeCloseTo(0.3)
  })

  it('lets her standing height drift slowly while she stands about still', () => {
    const sight = createSight()
    frames(sight, standing(), SETTLE_MS + 100)
    const lower = changed({ lShoulder: [0.58, 0.315], rShoulder: [0.42, 0.315] })
    expect(frames(sight, lower, 8000).standY).toBeCloseTo(0.315, 2)
  })
})

describe('arms', () => {
  it('knows arms up and arms down', () => {
    for (const side of ['l', 'r'] as const) {
      expect(armUp(ARMS_UP, side, UNIT)).toBe(true)
      expect(armDown(ARMS_UP, side, UNIT)).toBe(false)
      expect(armUp(standing(), side, UNIT)).toBe(false)
      expect(armDown(standing(), side, UNIT)).toBe(true)
      // Out to the side or on the head is neither
      expect(armUp(ARMS_T, side, UNIT)).toBe(false)
      expect(armDown(ARMS_T, side, UNIT)).toBe(false)
      expect(armUp(HANDS_ON_HEAD, side, UNIT)).toBe(false)
    }
  })

  it('counts an arm as up when the hand left the top of the picture but the elbow is high', () => {
    const cut = unseen(['lWrist', 'rWrist'], ARMS_UP)
    expect(armUp(cut, 'l', UNIT)).toBe(true)
    expect(armUp(cut, 'r', UNIT)).toBe(true)
    // Nothing of the arm seen: not up
    expect(armUp(unseen(['lWrist', 'lElbow'], ARMS_UP), 'l', UNIT)).toBe(false)
  })

  it('counts an arm as down when the hand left the bottom of the picture but the elbow hangs', () => {
    expect(armDown(unseen(['lWrist'], standing()), 'l', UNIT)).toBe(true)
    expect(armDown(unseen(['lWrist'], BEND), 'l', UNIT)).toBe(true)
  })
})
