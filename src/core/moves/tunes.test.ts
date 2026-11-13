import { describe, expect, it } from 'vitest'
import { BEATS_PER_SONG, BEAT_MS, TUNES, noteFreq } from './tunes'

describe('tunes', () => {
  it('has three tunes of 64 beats at 100 beats a minute', () => {
    expect(BEAT_MS).toBe(600)
    expect(BEATS_PER_SONG).toBe(64)
    expect(TUNES).toHaveLength(3)
    for (const tune of TUNES) expect(tune).toHaveLength(BEATS_PER_SONG)
  })

  it('plays only notes a child can hear comfortably, starting on a note', () => {
    for (const tune of TUNES) {
      expect(tune[0]).not.toBeNull()
      for (const f of tune.filter(f => f !== null)) {
        expect(f).toBeGreaterThan(190)
        expect(f).toBeLessThan(1000)
      }
    }
  })

  it('turns note names into pitches', () => {
    expect(noteFreq('A4')).toBeCloseTo(440)
    expect(noteFreq('C5')).toBeCloseTo(523.25, 1)
    expect(() => noteFreq('H9')).toThrow()
  })
})
