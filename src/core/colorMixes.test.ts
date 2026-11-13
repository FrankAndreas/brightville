import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { COLORS, MIXES, buildLab, LAB_TASKS } from './colorMixes'

describe('the colour mixes', () => {
  it('knows six mixes, each of two different colours', () => {
    expect(MIXES).toHaveLength(6)
    for (const m of MIXES) {
      expect(m.a).not.toBe(m.b)
      for (const c of [m.a, m.b, m.result]) expect(COLORS[c], c).toBeDefined()
    }
    // A mix has one answer
    expect(new Set(MIXES.map(m => [m.a, m.b].sort().join('+'))).size).toBe(6)
  })

  it('gives a visit five mixes, never the same twice, each with three different colours to pick', () => {
    for (let seed = 1; seed < 30; seed++) {
      const lab = buildLab(seededRandom(seed))
      expect(lab).toHaveLength(LAB_TASKS)
      expect(new Set(lab.map(t => t.mix.result + t.mix.a)).size).toBe(LAB_TASKS)
      for (const t of lab) {
        expect(t.choices).toHaveLength(3)
        expect(new Set(t.choices).size).toBe(3)
        expect(t.choices[t.answer]).toBe(t.mix.result)
        // The pots themselves are not offered as the answer
        expect(t.choices).not.toContain(t.mix.a)
        expect(t.choices).not.toContain(t.mix.b)
      }
    }
  })

  it('puts the right answer in different places', () => {
    const places = new Set<number>()
    for (let seed = 1; seed < 30; seed++) for (const t of buildLab(seededRandom(seed))) places.add(t.answer)
    expect(places).toEqual(new Set([0, 1, 2]))
  })
})
