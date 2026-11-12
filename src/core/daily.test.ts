import { describe, expect, it } from 'vitest'
import { DAILY_GOAL, dayOf, goalReached, visitsOn } from './daily'

describe('daily goal', () => {
  it('formats the local day', () => {
    expect(dayOf(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(dayOf(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01')
  })

  it('counts visits only for the same day', () => {
    const save = { day: '2026-11-12', visits: 2 }
    expect(visitsOn(save, '2026-11-12')).toBe(2)
    expect(visitsOn(save, '2026-11-13')).toBe(0)
    expect(visitsOn({ day: '', visits: 0 }, '2026-11-12')).toBe(0)
  })

  it('reaches the goal at 2', () => {
    expect(DAILY_GOAL).toBe(2)
    expect([0, 1, 2, 3].map(goalReached)).toEqual([false, false, true, true])
  })
})
