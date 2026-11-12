import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { FIXTURES, standing } from '@/core/pose/fixtures'
import type { PoseId } from '@/core/pose/poses'
import { POSES_PER_VISIT, STARS_PER_POSE, createYogaFlow, pickPoses, type YogaEffect, type YogaFlow } from './flow'

const poses: PoseId[] = ['stern', 'frosch', 'riese']

/** Feeds frames of one body for a while, in 100 ms steps; returns the effects. */
function feed(flow: YogaFlow, body: Body | null, ms: number): YogaEffect[] {
  const effects: YogaEffect[] = []
  for (let t = 0; t < ms; t += 100) effects.push(...flow.send({ type: 'frame', body, dtMs: 100 }))
  return effects
}

function calibrated(): YogaFlow {
  const flow = createYogaFlow(poses)
  flow.send({ type: 'cameraReady' })
  feed(flow, standing(), 1000)
  return flow
}

describe('pickPoses', () => {
  it('returns 3 different known poses', () => {
    expect([POSES_PER_VISIT, STARS_PER_POSE]).toEqual([3, 3])
    for (let seed = 0; seed < 20; seed++) {
      let n = seed
      const picked = pickPoses(() => (n = (n * 7 + 3) % 11) / 11)
      expect(picked).toHaveLength(3)
      expect(new Set(picked).size).toBe(3)
      for (const id of picked) expect(Object.keys(FIXTURES)).toContain(id)
    }
  })
})

describe('yoga flow', () => {
  it('starts waiting for the camera', () => {
    expect(createYogaFlow(poses).state).toMatchObject({ phase: 'starting', pose: null, stars: 0, progress: 0 })
  })

  it('asks the child to step into view once the camera is ready', () => {
    const flow = createYogaFlow(poses)
    expect(flow.send({ type: 'cameraReady' })).toEqual([
      { type: 'speak', text: 'Stell dich so hin, dass ich dich ganz sehe!' },
    ])
    expect(flow.state.phase).toBe('calibrating')
  })

  it('shows whether the body is in view', () => {
    const flow = createYogaFlow(poses)
    flow.send({ type: 'cameraReady' })
    flow.send({ type: 'frame', body: standing(), dtMs: 100 })
    expect(flow.state.bodyVisible).toBe(true)
    flow.send({ type: 'frame', body: null, dtMs: 100 })
    expect(flow.state.bodyVisible).toBe(false)
  })

  it('goes through calibration, three poses and ends with 9 stars', () => {
    const flow = createYogaFlow(poses)
    flow.send({ type: 'cameraReady' })
    const first = feed(flow, standing(), 1000)
    expect(first).toEqual([{ type: 'speak', text: 'Mach einen Stern!' }])
    expect(flow.state).toMatchObject({ phase: 'posing', pose: 'stern', poseNumber: 1 })

    expect(feed(flow, FIXTURES.stern, 5000)).toEqual([
      { type: 'chime' }, { type: 'speak', text: 'Hock dich hin wie ein Frosch!' },
    ])
    expect(flow.state).toMatchObject({ pose: 'frosch', poseNumber: 2, stars: 3, progress: 0 })

    feed(flow, FIXTURES.frosch, 5000)
    expect(flow.state).toMatchObject({ pose: 'riese', poseNumber: 3, stars: 6 })

    expect(feed(flow, FIXTURES.riese, 5000)).toEqual([
      { type: 'chime' }, { type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' },
    ])
    expect(flow.state).toMatchObject({ phase: 'done', stars: 9 })
  })

  it('fills the ring while the pose is held', () => {
    const flow = calibrated()
    feed(flow, FIXTURES.stern, 2500)
    expect(flow.state.progress).toBeCloseTo(0.5)
  })

  it('gives no stars for a pose that times out and moves on', () => {
    const flow = calibrated()
    const effects = feed(flow, standing(), 30000)
    expect(effects).toEqual([{ type: 'speak', text: 'Hock dich hin wie ein Frosch!' }])
    expect(flow.state).toMatchObject({ phase: 'posing', pose: 'frosch', poseNumber: 2, stars: 0 })
  })

  it('ends without stars when every pose times out', () => {
    const flow = calibrated()
    feed(flow, standing(), 90000)
    expect(flow.state).toMatchObject({ phase: 'done', stars: 0 })
  })

  it('survives frames with no body', () => {
    const flow = calibrated()
    expect(() => feed(flow, null, 31000)).not.toThrow()
    expect(flow.state).toMatchObject({ phase: 'posing', pose: 'frosch', stars: 0 })
  })

  it('camera failure before the start shows no camera', () => {
    const flow = createYogaFlow(poses)
    expect(flow.send({ type: 'cameraFailed' })).toEqual([{ type: 'speak', text: 'Ich finde keine Kamera.' }])
    expect(flow.state.phase).toBe('noCamera')
  })

  it('camera failure during a pose keeps earned stars', () => {
    const flow = calibrated()
    feed(flow, FIXTURES.stern, 5000)
    flow.send({ type: 'cameraFailed' })
    expect(flow.state).toMatchObject({ phase: 'noCamera', stars: 3 })
  })

  it('ignores events after done and after no camera', () => {
    const flow = calibrated()
    feed(flow, standing(), 90000)
    expect(flow.send({ type: 'cameraFailed' })).toEqual([])
    expect(feed(flow, FIXTURES.stern, 6000)).toEqual([])
    expect(flow.state).toMatchObject({ phase: 'done', stars: 0 })

    const broken = createYogaFlow(poses)
    broken.send({ type: 'cameraFailed' })
    expect(broken.send({ type: 'cameraReady' })).toEqual([])
    expect(broken.state.phase).toBe('noCamera')
  })
})
