import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, SQUAT } from '@/core/moves/fixtures'
import { LOST_AFTER_MS } from '@/core/moves/sight'
import type { MoveId } from '@/core/moves/reps'
import {
  BREAK_MS, REPS_PER_ROUND, SAY_LOST, SAY_NO_CAMERA, SAY_STEP_IN, STARS_PER_ROUND, createJumpFlow, pickMoves,
  type JumpEffect, type JumpFlow,
} from './flow'

const STEP = 40

function feed(flow: JumpFlow, body: Body | null, ms: number): JumpEffect[] {
  const effects: JumpEffect[] = []
  for (let t = 0; t < ms; t += STEP) effects.push(...flow.send({ type: 'frame', body, dtMs: STEP }))
  return effects
}

function reps(flow: JumpFlow, rest: Body, peak: Body, n: number): JumpEffect[] {
  const effects = feed(flow, rest, 200)
  for (let i = 0; i < n; i++) effects.push(...feed(flow, peak, 200), ...feed(flow, rest, 200))
  return effects
}

const said = (effects: JumpEffect[]) => effects.flatMap(e => (e.type === 'speak' ? [e.text] : []))

function started(moves: MoveId[] = ['hampelmann', 'kniebeuge', 'huepfen']) {
  const flow = createJumpFlow(moves)
  flow.send({ type: 'cameraReady' })
  const effects = feed(flow, standing(), 1200)
  return { flow, effects }
}

describe('pickMoves', () => {
  it('picks three different moves', () => {
    const moves = pickMoves(() => 0.99)
    expect(moves).toHaveLength(3)
    expect(new Set(moves).size).toBe(3)
  })
})

describe('createJumpFlow', () => {
  it('asks her to step in, then names the first move once she is seen', () => {
    const flow = createJumpFlow(['hampelmann', 'kniebeuge', 'huepfen'])
    expect(said(flow.send({ type: 'cameraReady' }))).toEqual([SAY_STEP_IN])
    expect(flow.state.phase).toBe('settling')
    const effects = feed(flow, standing(), 1200)
    expect(flow.state).toMatchObject({ phase: 'moving', move: 'hampelmann', round: 1, count: 0 })
    expect(said(effects)[0]).toMatch(/Hampelmann/)
  })

  it('counts each rep with a beat, and counts aloud from seven', () => {
    const { flow } = started()
    const effects = reps(flow, standing(), ARMS_UP, 6)
    expect(flow.state.count).toBe(6)
    expect(effects.filter(e => e.type === 'beat')).toHaveLength(6)
    expect(said(effects)).toEqual([])
    expect(said(reps(flow, standing(), ARMS_UP, 3))).toEqual(['sieben', 'acht', 'neun'])
  })

  it('gives three Stars for a full round, takes a breath, then names the next move', () => {
    const { flow } = started()
    const effects = reps(flow, standing(), ARMS_UP, REPS_PER_ROUND)
    expect(effects.some(e => e.type === 'chime')).toBe(true)
    expect(said(effects).at(-1)).toMatch(/^Zehn! Super/)
    expect(flow.state).toMatchObject({ stars: STARS_PER_ROUND, round: 1, count: REPS_PER_ROUND })
    // Arms up during the break count for nothing
    reps(flow, standing(), ARMS_UP, 1)
    const next = feed(flow, standing(), BREAK_MS)
    expect(flow.state).toMatchObject({ round: 2, move: 'kniebeuge', count: 0 })
    expect(said(next).at(-1)).toMatch(/Kniebeuge/)
  })

  it('finishes with confetti after three rounds and 9 Stars', () => {
    const { flow } = started(['hampelmann', 'kniebeuge', 'hampelmann'])
    reps(flow, standing(), ARMS_UP, REPS_PER_ROUND)
    feed(flow, standing(), BREAK_MS + 100)
    reps(flow, standing(), SQUAT, REPS_PER_ROUND)
    feed(flow, standing(), BREAK_MS + 100)
    const effects = reps(flow, standing(), ARMS_UP, REPS_PER_ROUND)
    expect(flow.state).toMatchObject({ phase: 'done', stars: 3 * STARS_PER_ROUND })
    expect(effects.some(e => e.type === 'confetti')).toBe(true)
  })

  it('keeps the count when she is lost, says so, and goes on when she is back', () => {
    const { flow } = started()
    reps(flow, standing(), ARMS_UP, 4)
    const lost = feed(flow, null, LOST_AFTER_MS + 100)
    expect(said(lost)).toEqual([SAY_LOST])
    expect(flow.state).toMatchObject({ count: 4, lost: true })
    // Back: she settles again, then counting goes on from 4
    feed(flow, standing(), 1200)
    reps(flow, standing(), ARMS_UP, 2)
    expect(flow.state).toMatchObject({ count: 6, lost: false })
  })

  it('says when there is no camera and does nothing more', () => {
    const flow = createJumpFlow(['hampelmann', 'kniebeuge', 'huepfen'])
    expect(said(flow.send({ type: 'cameraFailed' }))).toEqual([SAY_NO_CAMERA])
    expect(flow.state.phase).toBe('noCamera')
    expect(flow.send({ type: 'cameraReady' })).toEqual([])
  })
})
