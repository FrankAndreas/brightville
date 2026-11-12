import { describe, expect, it } from 'vitest'
import { doorState } from './access'

const earn = { kind: 'earn' as const }
const play = { kind: 'play' as const, cost: 3 }

describe('doorState', () => {
  it('opens an earning building whenever the device can serve it', () => {
    expect(doorState(earn, true, false, 0)).toBe('open')
    expect(doorState(earn, true, true, 99)).toBe('open')
  })

  it('is unavailable when the device cannot serve it, whatever else holds', () => {
    expect(doorState(earn, false, true, 99)).toBe('unavailable')
    expect(doorState(play, false, false, 0)).toBe('unavailable')
    expect(doorState(play, false, true, 99)).toBe('unavailable')
  })

  it('locks a play building until the goal is reached, even with plenty of stars', () => {
    expect(doorState(play, true, false, 99)).toBe('locked')
    expect(doorState(play, true, false, 0)).toBe('locked')
  })

  it('needs the cost in stars once the goal is reached', () => {
    expect(doorState(play, true, true, 2)).toBe('poor')
    expect(doorState(play, true, true, 3)).toBe('open')
    expect(doorState(play, true, true, 4)).toBe('open')
  })

  it('closes a play building for the day when the play time is used up', () => {
    expect(doorState(play, true, true, 99, true)).toBe('timeUp')
    expect(doorState(play, true, true, 0, true)).toBe('timeUp')
  })

  it('still says "learn first" when both the goal and the play time stand in the way', () => {
    expect(doorState(play, true, false, 99, true)).toBe('locked')
  })

  it('never closes an earning building for play time', () => {
    expect(doorState(earn, true, true, 0, true)).toBe('open')
  })

  it('treats a play building without a cost as free', () => {
    expect(doorState({ kind: 'play' }, true, true, 0)).toBe('open')
  })
})
