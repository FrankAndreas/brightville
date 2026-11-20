import { describe, expect, it } from 'vitest'
import { applyResults, LAST_STEP, share, startLadders, WINDOW } from './ladders'

const at = (step: number, window: boolean[] = []) => ({ step, window })

describe('ladders', () => {
  it('two visits with one miss move Zählen up and empty the window', () => {
    const once = applyResults(at(1), [true, true, false], 'zaehlen')
    expect(once).toEqual(at(1, [true, true, false]))
    expect(applyResults(once, [true, true, true], 'zaehlen')).toEqual(at(2))
  })

  it('two misses in the last six do not move, and only six are kept', () => {
    const s = applyResults(applyResults(at(1), [true, false, true], 'zaehlen'), [true, false, true, true], 'zaehlen')
    expect(s).toEqual(at(1, [false, true, true, false, true, true]))
  })

  it('fewer answers than the window never move', () => {
    expect(applyResults(at(1), [true, true, true, true, true], 'zaehlen')).toEqual(at(1, [true, true, true, true, true]))
  })

  it('Rechnen needs four', () => {
    expect(WINDOW).toEqual({ zaehlen: 6, rechnen: 4, reimen: 10, muster: 10, zeit: 10, raum: 10, rhythmus: 10 })
    expect(applyResults(at(1), [true, true], 'rechnen').step).toBe(1)
    expect(applyResults(at(1, [true, true]), [true, false], 'rechnen')).toEqual(at(2))
  })

  it('moves Reimen up after ten answers with two misses', () => {
    const s = applyResults(at(1), [true, false, true, true, true, true, true, false, true, true], 'reimen')
    expect(s).toEqual(at(2))
  })

  it('keeps Reimen with three misses in ten', () => {
    expect(applyResults(at(1), [false, false, false, true, true, true, true, true, true, true], 'reimen').step).toBe(1)
  })

  it('moves Muster up after ten answers with two misses, not with three', () => {
    expect(applyResults(at(1), [true, false, true, true, true, true, true, false, true, true], 'muster')).toEqual(at(2))
    expect(applyResults(at(1), [false, false, false, true, true, true, true, true, true, true], 'muster').step).toBe(1)
  })

  it('moves Zeit up after ten answers with two misses', () => {
    expect(applyResults(at(1), [true, false, true, true, true, true, true, false, true, true], 'zeit')).toEqual(at(2))
  })

  it('moves Raum up after ten answers with two misses', () => {
    expect(applyResults(at(1), [true, false, true, true, true, true, true, false, true, true], 'raum')).toEqual(at(2))
  })

  it('step 6 is the last', () => {
    expect(LAST_STEP).toBe(6)
    expect(applyResults(at(6), [true, true, true, true], 'rechnen')).toEqual(at(6))
    expect(applyResults(at(5, [true, true]), [true, true], 'rechnen')).toEqual(at(6))
  })

  it('no answers change nothing', () => {
    expect(applyResults(at(2, [true]), [], 'zaehlen')).toEqual(at(2, [true]))
  })

  it('starts like the server', () => {
    expect(startLadders(false)).toEqual({ zaehlen: at(1), rechnen: at(1), reimen: at(1), muster: at(1), zeit: at(1), raum: at(1), rhythmus: at(1) })
    expect(startLadders(true)).toEqual({ zaehlen: at(1), rechnen: at(2), reimen: at(1), muster: at(1), zeit: at(1), raum: at(1), rhythmus: at(1) })
  })

  it('a step is a share of the way to the end of Zyklus 1', () => {
    expect(share(1)).toBe(0)
    expect(share(3)).toBeCloseTo(0.4)
    expect(share(6)).toBe(1)
  })
})
