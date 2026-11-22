import { describe, expect, it } from 'vitest'
import { isLearned, nextBox } from './boxes'

describe('nextBox (the same table as the server)', () => {
  it.each([
    [0, true, 1, '2026-11-13'],
    [1, true, 2, '2026-11-14'],
    [2, true, 3, '2026-11-16'],
    [3, true, 4, '2026-11-20'],
    [4, true, 5, '2026-11-28'],
    [5, true, 5, '2026-12-14'],
    [4, false, 1, '2026-11-13'],
    [0, false, 1, '2026-11-13'],
  ])('box %i, right %s → box %i due %s', (box, right, next, due) => {
    expect(nextBox(box, right, '2026-11-12')).toEqual({ box: next, due })
  })

  it('crosses months and years', () => {
    expect(nextBox(5, true, '2026-12-20')).toEqual({ box: 5, due: '2027-01-21' })
  })

  it('a word is learned from box 3', () => {
    expect(isLearned(2)).toBe(false)
    expect(isLearned(3)).toBe(true)
  })
})
