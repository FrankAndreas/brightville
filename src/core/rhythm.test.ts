import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import {
  beatTimes, buildRhythmSession, exampleFor, findOnsets, judge, KEEP_BEATS, LEAD_IN, taskText, TOLERANCE_MS, type Hit,
  type RhythmTask,
} from './rhythm'

const keep: RhythmTask = { type: 'keep', bpm: 90 }
const beat = 60000 / 90
const hitsAt = (ts: number[]): Hit[] => ts.map(t => ({ t }))

describe('the tasks of a visit', () => {
  it('asks five of the step\'s kinds, never the same twice', () => {
    for (let seed = 0; seed < 120; seed++) {
      const step = 1 + (seed % 6)
      const tasks = buildRhythmSession(step, seededRandom(seed))
      expect(tasks).toHaveLength(5)
      const kinds = tasks.map(t => t.type)
      if (step <= 2) expect(kinds.every(k => k === 'keep')).toBe(true)
      if (step === 2) expect(tasks.every(t => t.type === 'keep' && t.speed)).toBe(true)
      if (step === 3) expect(kinds.every(k => k === 'dynamics')).toBe(true)
      if (step === 4) for (const t of tasks) expect(t.type === 'copy' && t.gaps.length + 1).toBeLessThanOrEqual(4)
      if (step === 5) for (const t of tasks) expect(t.type === 'copy' && t.gaps.length + 1).toBeGreaterThanOrEqual(5)
      if (step === 6) expect(new Set(kinds)).toEqual(new Set(['keep', 'dynamics', 'copy']))
      expect(new Set(tasks.map(t => JSON.stringify(t))).size).toBe(5)
    }
  })

  it('plays two beats to listen to, then eight to join', () => {
    const times = beatTimes(keep)
    expect(times).toHaveLength(LEAD_IN + KEEP_BEATS)
    expect(times[1] - times[0]).toBeCloseTo(beat)
    expect(beatTimes({ type: 'copy', gaps: [500, 250] })).toEqual([0, 500, 750])
  })

  it('says each task in a whole sentence for tapping and for clapping', () => {
    expect(taskText(keep, 'clap')).toBe('Hör zu und klatsch mit! Halte den Takt.')
    expect(taskText(keep, 'tap')).toBe('Hör zu und tipp mit! Halte den Takt.')
    expect(taskText({ type: 'keep', bpm: 120, speed: 'schnell' }, 'clap')).toBe('Jetzt ganz schnell! Klatsch mit.')
    expect(taskText({ type: 'dynamics', order: ['leise', 'leise', 'laut', 'laut'] }, 'clap')).toBe('Hör zu: zweimal leise, dann zweimal laut. Jetzt du!')
    expect(taskText({ type: 'dynamics', order: ['laut', 'leise', 'laut', 'leise'] }, 'tap'))
      .toBe('Die große Trommel ist laut, die kleine leise. Hör zu: laut, leise, laut, leise. Jetzt du!')
    expect(taskText({ type: 'copy', gaps: [500] }, 'clap')).toBe('Hör zu und mach es nach!')
  })

  it('shows a task once first until two visits are done at the step, never at fertig', () => {
    expect(exampleFor(1, 0)).toBe(true)
    expect(exampleFor(3, 10)).toBe(false)
    expect(exampleFor(6, 0)).toBe(false)
  })
})

describe('judging', () => {
  const beats = Array.from({ length: KEEP_BEATS }, (_, k) => k * beat)

  it('keeps the beat with six of eight within the tolerance', () => {
    expect(judge(keep, hitsAt(beats), 'tap')).toBe(true)
    const six = beats.map((t, k) => (k < 6 ? t + TOLERANCE_MS - 1 : t + 400))
    expect(judge(keep, hitsAt(six), 'tap')).toBe(true)
    const five = beats.map((t, k) => (k < 5 ? t - TOLERANCE_MS + 1 : t + TOLERANCE_MS + 1))
    expect(judge(keep, hitsAt(five), 'tap')).toBe(false)
  })

  it('doesn\'t take a stream of taps as keeping the beat', () => {
    expect(judge(keep, hitsAt(Array.from({ length: 40 }, (_, k) => k * 140)), 'tap')).toBe(false)
  })

  it('copies a rhythm with the same beats, each gap within a third', () => {
    const copy: RhythmTask = { type: 'copy', gaps: [500, 250, 500] }
    expect(judge(copy, hitsAt([1000, 1500, 1750, 2250]), 'clap')).toBe(true)
    expect(judge(copy, hitsAt([0, 670, 900, 1550]), 'clap')).toBe(true)
    // Exactly a third more or less is still right, both ways
    expect(judge(copy, hitsAt([0, 675, 912.5, 1587.5]), 'clap')).toBe(true)
    expect(judge(copy, hitsAt([0, 325, 487.5, 812.5]), 'clap')).toBe(true)
    expect(judge(copy, hitsAt([0, 500, 1000, 1500]), 'clap')).toBe(false)
    expect(judge(copy, hitsAt([0, 500, 750]), 'clap')).toBe(false)
  })

  it('takes loud and quiet from the drums when tapping, from the claps\' loudness when clapping', () => {
    const order: RhythmTask = { type: 'dynamics', order: ['leise', 'leise', 'laut', 'laut'] }
    const taps = (big: boolean[]) => big.map((b, k) => ({ t: k * 600, big: b }))
    expect(judge(order, taps([false, false, true, true]), 'tap')).toBe(true)
    expect(judge(order, taps([false, true, true, true]), 'tap')).toBe(false)
    const claps = (peaks: number[]) => peaks.map((peak, k) => ({ t: k * 600, peak }))
    expect(judge(order, claps([0.2, 0.25, 0.5, 0.6]), 'clap')).toBe(true)
    expect(judge(order, claps([0.3, 0.35, 0.4, 0.45]), 'clap')).toBe(false)
    expect(judge(order, claps([0.6, 0.5, 0.2, 0.25]), 'clap')).toBe(false)
  })
})

describe('hearing claps', () => {
  const quiet = (t: number) => ({ t, level: 0.01 })
  it('finds a clap where the sound jumps above the room, once per 120 ms, with its peak', () => {
    const levels = [quiet(0), quiet(10), { t: 20, level: 0.3 }, { t: 30, level: 0.5 }, { t: 40, level: 0.2 }, quiet(50),
      { t: 100, level: 0.4 }, quiet(110), { t: 300, level: 0.35 }, quiet(310)]
    expect(findOnsets(levels, 0.01)).toEqual([{ t: 20, peak: 0.5 }, { t: 300, peak: 0.35 }])
  })

  it('hears nothing in a quiet room', () => {
    expect(findOnsets([quiet(0), { t: 10, level: 0.02 }, quiet(20)], 0.01)).toEqual([])
  })
})
