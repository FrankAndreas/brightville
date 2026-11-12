import { describe, expect, it } from 'vitest'
import { emptySave, parseSave, serializeSave } from './save'

describe('parseSave', () => {
  it.each([
    null, '', 'not json', '[]', 'null', '{"version":1}', '{"version":1,"stars":-4}',
    '{"version":1,"stars":2.5}', '{"version":1,"stars":"7"}', '{"version":2,"stars":9}',
  ])('falls back to an empty save for %s', raw => {
    expect(parseSave(raw)).toEqual({ version: 1, stars: 0 })
  })

  it('round-trips', () => {
    expect(parseSave(serializeSave({ version: 1, stars: 12 }))).toEqual({ version: 1, stars: 12 })
  })

  it('gives a fresh object each time', () => {
    expect(emptySave()).not.toBe(emptySave())
  })
})
