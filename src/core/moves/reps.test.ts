import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, BEND, HOP, SQUAT, unseen } from './fixtures'
import { HOLD_PHASE_MS, MOVES, createReps, type MoveId } from './reps'
import type { SightState } from './sight'

const sight: SightState = { seen: true, ready: true, lost: false, sayLost: false, standY: 0.3, unit: 0.16 }

/** Feeds each body for a while; returns how many reps were counted. */
function count(move: MoveId, bodies: (Body | null)[], ms = 200, s: SightState = sight): number {
  const reps = createReps(move)
  let n = 0
  for (const body of bodies) {
    for (let t = 0; t < ms; t += 40) if (reps.update(body, s, 40)) n++
  }
  return n
}

const REST_AND_PEAK: Record<MoveId, [Body, Body]> = {
  hampelmann: [standing(), ARMS_UP],
  huepfen: [standing(), HOP],
  kniebeuge: [standing(), SQUAT],
  strecken: [ARMS_UP, BEND],
}

describe('createReps', () => {
  it('lists the four moves of the Hüpfhalle', () => {
    expect(MOVES.map(m => m.id)).toEqual(['hampelmann', 'huepfen', 'kniebeuge', 'strecken'])
    for (const m of MOVES) expect(m.voice).toMatch(/\S/)
  })

  for (const [move, [rest, peak]] of Object.entries(REST_AND_PEAK) as [MoveId, [Body, Body]][]) {
    describe(move, () => {
      it('counts one rep for rest, peak, rest', () => {
        expect(count(move, [rest, peak, rest])).toBe(1)
        expect(count(move, [rest, peak, rest, peak, rest, peak, rest])).toBe(3)
      })

      it('counts nothing until she was in the starting position', () => {
        expect(count(move, [peak, rest])).toBe(0)
      })

      it('does not count a single flickering frame', () => {
        const reps = createReps(move)
        let n = 0
        for (let i = 0; i < 10; i++) if (reps.update(rest, sight, 40)) n++
        // One frame of peak, shorter than a phase must hold
        if (reps.update(peak, sight, HOLD_PHASE_MS / 2)) n++
        for (let i = 0; i < 10; i++) if (reps.update(rest, sight, 40)) n++
        expect(n).toBe(0)
      })

      it('still counts when the tracker drops frames in the middle', () => {
        expect(count(move, [rest, peak, null, peak, rest])).toBe(1)
      })

      it('counts nothing while she is not settled in view', () => {
        expect(count(move, [rest, peak, rest], 200, { ...sight, ready: false })).toBe(0)
      })
    })
  }

  it('counts a jumping jack whose hands leave the top of the picture', () => {
    expect(count('hampelmann', [standing(), unseen(['lWrist', 'rWrist'], ARMS_UP), standing()])).toBe(1)
  })

  it('does not count a jumping jack with only one arm', () => {
    const oneArm = { ...standing(), lElbow: ARMS_UP.lElbow, lWrist: ARMS_UP.lWrist }
    expect(count('hampelmann', [standing(), oneArm, standing()])).toBe(0)
  })

  it('does not count a little bob as a hop or a squat', () => {
    const bob = { ...standing(), lShoulder: { ...standing().lShoulder, y: 0.32 }, rShoulder: { ...standing().rShoulder, y: 0.32 } }
    expect(count('huepfen', [standing(), bob, standing()])).toBe(0)
    expect(count('kniebeuge', [standing(), bob, standing()])).toBe(0)
  })
})
