import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, SQUAT } from '@/core/moves/fixtures'
import { LOST_AFTER_MS } from '@/core/moves/sight'
import { BREAK_MS, SAY_LOST, SAY_STEP_IN } from '@/buildings/huepfhalle/flow'
import { createWorkoutFlow, pickWorkout, splitTen, type WorkoutEffect, type WorkoutFlow, type WorkoutPart } from './workout'
import { coachWords } from './words'

const STEP = 40
const en = coachWords('en')

function feed(flow: WorkoutFlow, body: Body | null, ms: number): WorkoutEffect[] {
  const effects: WorkoutEffect[] = []
  for (let t = 0; t < ms; t += STEP) effects.push(...flow.send({ type: 'frame', body, dtMs: STEP }))
  return effects
}
function reps(flow: WorkoutFlow, rest: Body, peak: Body, n: number): WorkoutEffect[] {
  const effects = feed(flow, rest, 200)
  for (let i = 0; i < n; i++) effects.push(...feed(flow, peak, 200), ...feed(flow, rest, 200))
  return effects
}
const said = (effects: WorkoutEffect[]) => effects.flatMap(e => (e.type === 'speak' ? [e.text] : []))

function started(rounds: WorkoutPart[][]) {
  const flow = createWorkoutFlow(rounds, en)
  const effects = [...flow.send({ type: 'cameraReady' }), ...feed(flow, standing(), 1200)]
  return { flow, effects }
}

const ROUND: WorkoutPart[] = [{ move: 'kniebeuge', n: 4 }, { move: 'hampelmann', n: 6 }]

describe('the workout', () => {
  it('splits ten into parts of three to seven', () => {
    for (let i = 0; i < 1000; i++) {
      const parts = splitTen(Math.random)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(10)
      for (const p of parts) expect(p >= 3 && p <= 7).toBe(true)
    }
  })

  it('picks three rounds whose parts change the move', () => {
    const rounds = pickWorkout(Math.random)
    expect(rounds).toHaveLength(3)
    for (const r of rounds) {
      expect(r.reduce((a, p) => a + p.n, 0)).toBe(10)
      for (let i = 1; i < r.length; i++) expect(r[i].move).not.toBe(r[i - 1].move)
    }
  })

  it('says the setup in German, then the part in English, and counts every rep', () => {
    const { flow, effects } = started([ROUND, ROUND, ROUND])
    expect(said(effects)).toEqual([SAY_STEP_IN, 'Do four squats!'])
    expect(effects.find(e => e.type === 'speak' && e.text === 'Do four squats!')).toMatchObject({ coach: true, ask: true })
    const counted = reps(flow, standing(), SQUAT, 4)
    expect(said(counted)).toEqual(['one', 'two', 'three', 'four', 'Great!', 'Do six jumping jacks!'])
    expect(flow.state).toMatchObject({ part: 2, count: 0, n: 6, move: 'hampelmann' })
  })

  it('a round of ten gives three Stars, a break, then the next round', () => {
    const { flow } = started([ROUND, ROUND, ROUND])
    reps(flow, standing(), SQUAT, 4)
    const end = reps(flow, standing(), ARMS_UP, 6)
    expect(end.some(e => e.type === 'chime')).toBe(true)
    expect(flow.state).toMatchObject({ stars: 3, phase: 'break' })
    const next = feed(flow, standing(), BREAK_MS + 100)
    expect(said(next).at(-1)).toBe('Do four squats!')
    expect(flow.state.round).toBe(2)
  })

  it('three rounds: nine Stars, done', () => {
    const { flow } = started([ROUND, ROUND, ROUND])
    for (let r = 0; r < 3; r++) {
      reps(flow, standing(), SQUAT, 4)
      const end = reps(flow, standing(), ARMS_UP, 6)
      if (r < 2) feed(flow, standing(), BREAK_MS + 100)
      else expect(said(end).at(-1)).toBe(en.done)
    }
    expect(flow.state).toMatchObject({ phase: 'done', stars: 9 })
  })

  it('keeps the count when he is lost, in German', () => {
    const { flow } = started([ROUND, ROUND, ROUND])
    reps(flow, standing(), SQUAT, 2)
    expect(said(feed(flow, null, LOST_AFTER_MS + 100))).toEqual([SAY_LOST])
    feed(flow, standing(), 1200)
    reps(flow, standing(), SQUAT, 1)
    expect(flow.state.count).toBe(3)
  })
})
