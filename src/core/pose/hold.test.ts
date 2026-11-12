import { describe, expect, it } from 'vitest'
import { DRAIN_FACTOR, HOLD_MS, POSE_TIMEOUT_MS, createHold } from './hold'
import { CALIBRATION_MS, createCalibration } from './calibration'

describe('createHold', () => {
  it('uses the agreed times', () => {
    expect([HOLD_MS, DRAIN_FACTOR, POSE_TIMEOUT_MS, CALIBRATION_MS]).toEqual([5000, 0.5, 30000, 1000])
  })

  it('is done after 5000 ms of matching', () => {
    const hold = createHold()
    expect(hold.update(true, 4900)).toEqual({ progress: 0.98, status: 'holding' })
    expect(hold.update(true, 100)).toEqual({ progress: 1, status: 'done' })
  })

  it('drains at half speed and never below 0', () => {
    const hold = createHold()
    hold.update(true, 2000)
    expect(hold.update(false, 2000).progress).toBeCloseTo(0.2)
    expect(hold.update(false, 10000).progress).toBe(0)
  })

  it('does not reset when the pose is lost for a moment', () => {
    const hold = createHold()
    hold.update(true, 3000)
    hold.update(false, 200)
    expect(hold.update(true, 0).progress).toBeCloseTo(0.58)
  })

  it('times out after 30000 ms without finishing', () => {
    const hold = createHold()
    expect(hold.update(false, 29999).status).toBe('holding')
    expect(hold.update(false, 1).status).toBe('timeout')
  })

  it('reports done, not timeout, when both happen in one update', () => {
    const hold = createHold()
    hold.update(false, 26000)
    expect(hold.update(true, 5000).status).toBe('done')
  })

  it('ignores negative and broken frame times', () => {
    const hold = createHold()
    hold.update(true, 1000)
    expect(hold.update(true, -500).progress).toBeCloseTo(0.2)
    expect(hold.update(true, NaN).progress).toBeCloseTo(0.2)
  })
})

describe('createCalibration', () => {
  it('needs 1000 ms without a gap', () => {
    const c = createCalibration()
    expect(c.update(true, 900)).toBe(false)
    expect(c.update(false, 100)).toBe(false)
    expect(c.update(true, 900)).toBe(false)
    expect(c.update(true, 100)).toBe(true)
  })
})
