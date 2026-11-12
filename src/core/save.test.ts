import { describe, expect, it } from 'vitest'
import { emptySave, parseSave, serializeSave } from './save'

const EMPTY = { version: 2, stars: 0, day: '', visits: 0 }

describe('parseSave', () => {
  it.each([
    null, '', 'not json', '[]', 'null', '{"version":1}', '{"version":1,"stars":-4}',
    '{"version":1,"stars":2.5}', '{"version":1,"stars":"7"}', '{"version":3,"stars":9,"day":"2026-11-12","visits":1}',
    '{"version":1,"stars":1e300}', '{"version":2,"stars":-1,"day":"2026-11-12","visits":1}', '{"stars":4}',
  ])('falls back to an empty save for %s', raw => {
    expect(parseSave(raw)).toEqual(EMPTY)
  })

  it('carries a version 1 save over with its stars', () => {
    expect(parseSave('{"version":1,"stars":12}')).toEqual({ version: 2, stars: 12, day: '', visits: 0 })
  })

  it('round-trips version 2', () => {
    const save = { version: 2 as const, stars: 12, day: '2026-11-12', visits: 2 }
    expect(parseSave(serializeSave(save))).toEqual(save)
  })

  it.each([
    '{"version":2,"stars":5}',
    '{"version":2,"stars":5,"day":7,"visits":1}',
    '{"version":2,"stars":5,"day":"2026-11-12","visits":-1}',
    '{"version":2,"stars":5,"day":"2026-11-12","visits":1.5}',
    '{"version":2,"stars":5,"day":"2026-11-12","visits":"2"}',
    '{"version":2,"stars":5,"day":"tomorrow","visits":1}',
  ])('keeps the stars but empties the day for %s', raw => {
    expect(parseSave(raw)).toEqual({ version: 2, stars: 5, day: '', visits: 0 })
  })

  it('gives a fresh object each time', () => {
    expect(emptySave()).not.toBe(emptySave())
    expect(emptySave()).toEqual(EMPTY)
  })
})
