import { describe, expect, it } from 'vitest'
import { MAX_TEXT, MAX_TEXTS, applyWrite, checkText, helpFor, normalizeText, type LetterState } from './levels'

const at = '2026-11-14T10:00:00+01:00'
const s = (level: LetterState['level'], streak = 0): LetterState => ({ level, streak, practised_at: null })

/** The writes one after the other */
function run(start: LetterState, writes: boolean[]): LetterState {
  return writes.reduce((now, clean) => applyWrite(now, clean, at), start)
}

describe('applyWrite (the server rule, backend/app/writing.py apply)', () => {
  it('moves up a level after three clean writes in a row', () => {
    expect(run(s(1), [true, true])).toEqual({ level: 1, streak: 2, practised_at: at })
    expect(run(s(1), [true, true, true])).toEqual({ level: 2, streak: 0, practised_at: at })
  })

  it('moves down after three bumpy ones, never below the first level', () => {
    expect(run(s(2), [false, false, false]).level).toBe(1)
    expect(run(s(1), [false, false, false])).toEqual({ level: 1, streak: 0, practised_at: at })
  })

  it('starts the count again with a write of the other kind', () => {
    expect(run(s(1), [true, true, false])).toEqual({ level: 1, streak: -1, practised_at: at })
    expect(run(s(2), [false, false, true, true, true]).level).toBe(3)
  })

  it('stays known at the top', () => {
    expect(run(s(4), [true, true, true]).level).toBe(4)
  })
})

describe('helpFor', () => {
  it('shows less the better she knows the letter', () => {
    expect([0, 1, 2, 3, 4].map(l => helpFor(l as LetterState['level']))).toEqual(['full', 'full', 'dots', 'start', 'none'])
  })
})

describe('her texts', () => {
  it('are capitals with single spaces', () => {
    expect(normalizeText(' ich  mag ä ')).toBe('ICH MAG Ä')
  })

  it('are refused with a reason', () => {
    expect(checkText('GRÜSSE', [])).toBeNull()
    expect(checkText('Grüße', [])).toBe('letters')
    expect(checkText('HALLO!', [])).toBe('letters')
    expect(checkText('   ', [])).toBe('empty')
    expect(checkText('A'.repeat(MAX_TEXT), [])).toBeNull()
    expect(checkText('A'.repeat(MAX_TEXT + 1), [])).toBe('too-long')
    expect(checkText('mia', ['MIA'])).toBe('exists')
    expect(checkText('BEN', Array.from({ length: MAX_TEXTS }, (_, i) => `A${i}`))).toBe('too-many')
  })
})
