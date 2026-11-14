import { describe, expect, it } from 'vitest'
import {
  FLYER_X, GATES_TO_WIN, GROUND, HEARTS, RADIUS, SPEEDS, createFlight, flap, flyerX, tilt, update, type Flight, type FlightEvent,
} from './flight'

// Always the middle: every gap at the same height
const middle = () => 0.5

/** Runs the flight for `seconds` in 20 ms steps, flapping whenever `flapping` says so; returns every event */
function run(f: Flight, seconds: number, flapping: (f: Flight) => boolean = () => false): FlightEvent[] {
  const events: FlightEvent[] = []
  for (let t = 0; t < seconds * 1000; t += 20) {
    if (flapping(f)) flap(f)
    events.push(...update(f, 20))
  }
  return events
}

/** Keeps the flyer near the middle of the field, where every gap is */
const hold = (f: Flight) => f.y > 0.5 && f.vy >= 0

describe('a flight', () => {
  it('hovers in place until the first flap', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    const y = f.y
    expect(run(f, 3)).toEqual([])
    expect(f.y).toBe(y)
    expect(f.gates).toEqual([])
    expect(f.started).toBe(false)
  })

  it('rises with a flap and falls without', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    const start = f.y
    flap(f)
    update(f, 100)
    expect(f.y).toBeLessThan(start)
    run(f, 1)
    expect(f.y).toBeGreaterThan(start)
  })

  it('bounces softly off the meadow instead of losing', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    flap(f)
    const events = run(f, 4)
    expect(events).not.toContain('hit')
    expect(events).toContain('bounce')
    expect(f.y + RADIUS).toBeLessThanOrEqual(GROUND + 1e-9)
    expect(f.hearts).toBe(HEARTS)
  })

  it('stops at the top of the sky', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    run(f, 2, () => true)
    expect(f.y - RADIUS).toBeGreaterThanOrEqual(0)
  })

  it('counts a gate when the flyer is past it, and says when half are done', () => {
    const f = createFlight({ speed: 'schnell', width: 1.6, random: middle })
    flap(f)
    const events = run(f, 60, hold)
    expect(events.filter(e => e === 'passed')).toHaveLength(GATES_TO_WIN)
    expect(events.filter(e => e === 'half')).toHaveLength(1)
    // Right after the gate that makes half
    const counted = events.filter(e => e === 'passed' || e === 'half')
    expect(counted.indexOf('half')).toBe(Math.ceil(GATES_TO_WIN / 2))
  })

  it('wins after the last gate, and then stays still', () => {
    const f = createFlight({ speed: 'schnell', width: 1.6, random: middle })
    flap(f)
    const events = run(f, 60, hold)
    expect(events.filter(e => e === 'won')).toHaveLength(1)
    expect(f.over).toBe(true)
    expect(f.passed).toBe(GATES_TO_WIN)
    expect(update(f, 20)).toEqual([])
  })

  it('can be a shorter round', () => {
    const f = createFlight({ speed: 'schnell', width: 1.6, random: middle, toWin: 2 })
    flap(f)
    const events = run(f, 60, hold)
    expect(events.filter(e => e === 'passed')).toHaveLength(2)
    expect(events.filter(e => e === 'half')).toHaveLength(1)
    expect(events.at(-1)).toBe('won')
  })

  it('costs a heart on a cloud, then lets her fly on for a moment without another', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    flap(f)
    // Sitting on the meadow, far below every gap: the first cloud is hit
    const events = run(f, 9)
    expect(events.filter(e => e === 'hit')).toHaveLength(1)
    expect(f.hearts).toBe(HEARTS - 1)
  })

  it('ends when the last heart is gone', () => {
    const f = createFlight({ speed: 'schnell', width: 1.6, random: middle })
    flap(f)
    const events = run(f, 60)
    expect(events.filter(e => e === 'hit')).toHaveLength(HEARTS)
    expect(events.at(-1)).toBe('over')
    expect(f.over).toBe(true)
    expect(f.hearts).toBe(0)
  })

  it('makes the gaps smaller and the clouds faster with the speed', () => {
    expect(SPEEDS.langsam.gap).toBeGreaterThan(SPEEDS.mittel.gap)
    expect(SPEEDS.mittel.gap).toBeGreaterThan(SPEEDS.schnell.gap)
    expect(SPEEDS.langsam.pace).toBeLessThan(SPEEDS.mittel.pace)
    expect(SPEEDS.mittel.pace).toBeLessThan(SPEEDS.schnell.pace)
    // Even the smallest gap is far bigger than the flyer
    expect(SPEEDS.schnell.gap).toBeGreaterThan(RADIUS * 4)
  })

  it('keeps every gap in the sky and never far from the one before', () => {
    let n = 0
    const zigzag = () => (n++ % 2 ? 0 : 0.999)
    const f = createFlight({ speed: 'langsam', width: 1.6, random: zigzag })
    flap(f)
    const centres: number[] = []
    for (let t = 0; t < 120_000; t += 20) {
      if (hold(f)) flap(f)
      update(f, 20)
      for (const g of f.gates) if (!centres.includes(g.centre)) centres.push(g.centre)
      f.hearts = HEARTS
    }
    expect(centres.length).toBeGreaterThan(5)
    for (const c of centres) {
      expect(c - SPEEDS.langsam.gap / 2).toBeGreaterThan(0.05)
      expect(c + SPEEDS.langsam.gap / 2).toBeLessThan(GROUND - 0.05)
    }
    for (let i = 1; i < centres.length; i++) expect(Math.abs(centres[i] - centres[i - 1])).toBeLessThanOrEqual(0.25 + 1e-9)
  })

  it('brings the first gate in from the right edge, ahead of the flyer', () => {
    const f = createFlight({ speed: 'langsam', width: 2, random: middle })
    flap(f)
    update(f, 20)
    expect(f.gates).toHaveLength(1)
    expect(f.gates[0].x).toBeGreaterThan(2 - 0.1)
    expect(f.gates[0].x).toBeGreaterThan(FLYER_X)
  })

  it('keeps the flyer further left on an upright screen, so the next gate is seen in time', () => {
    expect(flyerX(createFlight({ speed: 'langsam', width: 1.6 }))).toBe(FLYER_X)
    const upright = createFlight({ speed: 'langsam', width: 0.75 })
    expect(flyerX(upright)).toBeLessThanOrEqual(0.75 * 0.3)
    // At least two seconds from the right edge to the flyer, at the slowest speed
    expect((0.75 - flyerX(upright)) / SPEEDS.langsam.pace).toBeGreaterThanOrEqual(2)
  })

  it('leans the flyer up while rising and down while falling', () => {
    const f = createFlight({ speed: 'langsam', width: 1.6, random: middle })
    flap(f)
    expect(tilt(f)).toBeLessThan(0)
    run(f, 1)
    expect(tilt(f)).toBeGreaterThan(0)
  })
})
