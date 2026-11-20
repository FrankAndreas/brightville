import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { buildMusterSession, exampleFor, pieceName, samePiece, TASKS_PER_VISIT, type MusterTask, type Piece } from './patterns'

type Row = Extract<MusterTask, { type: 'row' }>
type Sort = Extract<MusterTask, { type: 'sort' }>
const sessions = function* (): Generator<[number, MusterTask[]]> {
  for (let seed = 0; seed < 300; seed++) {
    const step = 1 + (seed % 6)
    yield [step, buildMusterSession(step, seededRandom(seed))]
  }
}
const rows = (tasks: MusterTask[]) => tasks.filter((t): t is Row => t.type === 'row')
const sorts = (tasks: MusterTask[]) => tasks.filter((t): t is Sort => t.type === 'sort')
const isGap = (r: Row) => r.gap < r.pieces.length - 1
/** The smallest repeating unit of a row */
function unitOf(pieces: Piece[]): number {
  for (let n = 1; n <= pieces.length; n++) if (pieces.every((p, i) => samePiece(p, pieces[i % n]))) return n
  return pieces.length
}

describe('a Musterwerkstatt visit', () => {
  it('asks five tasks of the step\'s kinds', () => {
    expect(TASKS_PER_VISIT).toBe(5)
    for (const [step, tasks] of sessions()) {
      expect(tasks, `step ${step}`).toHaveLength(5)
      const r = rows(tasks)
      const s = sorts(tasks)
      if (step === 1) expect(r.every(x => x.feature === 'colour' && unitOf(x.pieces) === 2 && !isGap(x))).toBe(true)
      if (step === 2) expect(r.every(x => x.feature === 'colour' && unitOf(x.pieces) === 3 && !isGap(x))).toBe(true)
      if (step <= 3) expect(r).toHaveLength(5)
      if (step === 3) expect(r.every(x => (x.feature === 'shape' || x.feature === 'size') && !isGap(x))).toBe(true)
      if (step === 4) expect(s.map(x => x.by).every(b => b === 'colour' || b === 'kind')).toBe(s.length === 5)
      if (step === 5) {
        expect(r.filter(isGap)).toHaveLength(2)
        expect(r.filter(x => x.feature === 'both')).toHaveLength(1)
        expect(s.filter(x => x.by === 'size')).toHaveLength(2)
      }
      if (step === 6) {
        expect(r.filter(x => !isGap(x) && x.feature !== 'both')).toHaveLength(1)
        expect(r.filter(isGap)).toHaveLength(1)
        expect(r.filter(x => x.feature === 'both')).toHaveLength(1)
        expect(s.filter(x => x.by !== 'size')).toHaveLength(1)
        expect(s.filter(x => x.by === 'size')).toHaveLength(1)
      }
    }
  })

  it('makes rows of 4 to 8 pieces that repeat, with exactly one choice that fits the gap', () => {
    for (const [, tasks] of sessions()) {
      for (const r of rows(tasks)) {
        expect(r.pieces.length).toBeGreaterThanOrEqual(5)
        expect(r.pieces.length).toBeLessThanOrEqual(8)
        expect(unitOf(r.pieces)).toBeLessThanOrEqual(3)
        expect(r.pieces.length).toBeGreaterThanOrEqual(2 * unitOf(r.pieces))
        const fits = r.choices.filter(c => samePiece(c, r.pieces[r.gap]))
        expect(fits).toHaveLength(1)
        expect(samePiece(r.choices[r.answer], r.pieces[r.gap])).toBe(true)
        expect(r.choices).toHaveLength(r.feature === 'size' ? 2 : 3)
      }
    }
  })

  it('changes only the row\'s own feature', () => {
    for (const [, tasks] of sessions()) {
      for (const r of rows(tasks)) {
        const all = [...r.pieces, ...r.choices]
        const kinds = (f: (p: Piece) => unknown) => new Set(all.map(f)).size
        if (r.feature === 'colour') expect([kinds(p => p.shape), kinds(p => p.big)]).toEqual([1, 1])
        if (r.feature === 'shape') expect([kinds(p => p.colour), kinds(p => p.big)]).toEqual([1, 1])
        if (r.feature === 'size') expect([kinds(p => p.colour), kinds(p => p.shape)]).toEqual([1, 1])
        if (r.feature === 'both') expect(kinds(p => p.big)).toBe(1)
      }
    }
  })

  it('makes each wrong choice in a two-thing row right in exactly one of colour and shape', () => {
    for (const [, tasks] of sessions()) {
      for (const r of rows(tasks).filter(x => x.feature === 'both')) {
        const right = r.pieces[r.gap]
        for (const [i, c] of r.choices.entries()) {
          if (i === r.answer) continue
          expect(Number(c.colour === right.colour) + Number(c.shape === right.shape)).toBe(1)
        }
      }
    }
  })

  it('never puts a gap first, and inside the row only in gap tasks', () => {
    for (const [step, tasks] of sessions()) {
      for (const r of rows(tasks)) {
        expect(r.gap).toBeGreaterThan(0)
        if (step <= 3) expect(r.gap).toBe(r.pieces.length - 1)
      }
    }
  })

  it('sorts four things, two per basket, apart from the two examples; a size sort with one picture', () => {
    for (const [, tasks] of sessions()) {
      for (const s of sorts(tasks)) {
        expect(s.things).toHaveLength(4)
        expect(s.things.filter(t => t.basket === 0)).toHaveLength(2)
        expect(s.examples.map(e => e.basket)).toEqual([0, 1])
        expect(new Set([...s.things, ...s.examples].map(t => t.id)).size).toBe(6)
        if (s.by === 'size') {
          expect(new Set([...s.things, ...s.examples].map(t => t.emoji)).size).toBe(1)
          for (const t of [...s.things, ...s.examples]) expect(t.big).toBe(t.basket === 0)
        }
        if (s.by === 'colour') for (const t of [...s.things, ...s.examples]) expect(t.piece).toBeDefined()
        if (s.by === 'size') expect(s.baskets).toEqual(['großen', 'kleinen'])
      }
    }
  })

  it('puts the right choice in every place, and asks no row twice in a visit', () => {
    const places = new Set<number>()
    for (const [, tasks] of sessions()) {
      for (const r of rows(tasks)) places.add(r.answer)
      const keys = tasks.map(t => JSON.stringify(t.type === 'row' ? [t.pieces, t.gap] : t.things.map(x => x.id)))
      expect(new Set(keys).size).toBe(5)
    }
    expect(places).toEqual(new Set([0, 1, 2]))
  })
})

describe('the voice\'s names', () => {
  it('names what changes in the row', () => {
    const p = (colour: Piece['colour'], shape: Piece['shape'], big = true): Piece => ({ colour, shape, big })
    expect(pieceName(p('rot', 'kreis'), 'colour')).toBe('rot')
    expect(pieceName(p('gruen', 'kreis'), 'colour')).toBe('grün')
    expect(pieceName(p('rot', 'kreis'), 'shape')).toBe('Kreis')
    expect(pieceName(p('rot', 'kreis'), 'size')).toBe('groß')
    expect(pieceName(p('rot', 'kreis', false), 'size')).toBe('klein')
    expect(pieceName(p('rot', 'kreis'), 'both')).toBe('roter Kreis')
    expect(pieceName(p('blau', 'dreieck'), 'both')).toBe('blaues Dreieck')
    expect(pieceName(p('gruen', 'quadrat'), 'both')).toBe('grünes Quadrat')
  })
})

describe('the example', () => {
  it('shows a row, a sort or a gap until two visits are done at the step, never at fertig', () => {
    expect(exampleFor(1, 0)?.kind).toBe('row')
    expect(exampleFor(3, 9)?.kind).toBe('row')
    expect(exampleFor(4, 0)?.kind).toBe('sort')
    expect(exampleFor(5, 0)?.kind).toBe('gap')
    expect(exampleFor(2, 10)).toBeNull()
    expect(exampleFor(6, 0)).toBeNull()
    const row = exampleFor(1, 0)?.task as Row
    expect(row.pieces.map(x => pieceName(x, 'colour'))).toEqual(['rot', 'blau', 'rot', 'blau', 'rot'])
    for (const step of [1, 2, 3, 5]) {
      const r = exampleFor(step, 0)?.task as Row
      expect(r.choices.every(Boolean), `step ${step}`).toBe(true)
      expect(r.choices.filter(x => samePiece(x, r.pieces[r.gap]))).toHaveLength(1)
    }
    expect((exampleFor(4, 0)?.task as Sort).examples[0].the).toBe('Der Hund')
  })
})
