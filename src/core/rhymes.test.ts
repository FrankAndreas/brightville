import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { buildRhymeSession, exampleFor, spokenSyllables, TASKS_PER_VISIT, WORDS, type RhymeTask, type Word } from './rhymes'

const group = <K extends string>(key: (w: Word) => K | undefined) => {
  const m = new Map<K, Word[]>()
  for (const w of WORDS) {
    const k = key(w)
    if (k !== undefined) m.set(k, [...(m.get(k) ?? []), w])
  }
  return m
}
const sessions = function* (): Generator<[number, RhymeTask[]]> {
  for (let seed = 0; seed < 300; seed++) {
    const step = 1 + (seed % 6)
    yield [step, buildRhymeSession(step, seededRandom(seed))]
  }
}

describe('the Reimhaus words', () => {
  it('splits every word into syllables that join to it', () => {
    for (const w of WORDS) expect(w.syllables.join('').toLowerCase(), w.id).toBe(w.say.toLowerCase())
  })

  it('has at least 12 rhyme groups of two, three words per first sound, four words per syllable count', () => {
    const rhymes = [...group(w => w.rhyme).values()].filter(g => g.length >= 2)
    expect(rhymes.length).toBeGreaterThanOrEqual(12)
    for (const [sound, words] of group(w => w.sound)) expect(words.length, sound).toBeGreaterThanOrEqual(3)
    for (const n of [1, 2, 3, 4]) expect(WORDS.filter(w => w.syllables.length === n).length, `${n}`).toBeGreaterThanOrEqual(4)
  })

  it('never puts S together with Sch, St or Sp', () => {
    for (const w of WORDS) if (w.sound === 'S') expect(w.say, w.id).not.toMatch(/^S(ch|t|p)/)
  })

  it('uses each id and each picture for one word only', () => {
    expect(new Set(WORDS.map(w => w.id)).size).toBe(WORDS.length)
    expect(new Set(WORDS.map(w => w.emoji)).size).toBe(WORDS.length)
  })
})

describe('a Reimhaus visit', () => {
  it('asks five tasks at each step, of the step\'s kinds', () => {
    expect(TASKS_PER_VISIT).toBe(5)
    for (const [step, tasks] of sessions()) {
      expect(tasks, `step ${step}`).toHaveLength(5)
      const kinds = tasks.map(t => t.type)
      const count = (k: string) => kinds.filter(x => x === k).length
      if (step <= 2) expect(count('rhyme')).toBe(5)
      if (step === 3) expect(count('sound')).toBe(5)
      if (step === 4) expect(count('syllables')).toBe(5)
      if (step === 5) expect([count('syllables'), count('sound')]).toEqual([3, 2])
      if (step === 6) expect([count('rhyme'), count('sound'), count('syllables')]).toEqual([2, 1, 2])
    }
  })

  it('offers two pictures at step 1 and three after', () => {
    for (const [step, tasks] of sessions()) {
      for (const t of tasks) if (t.type !== 'syllables') expect(t.choices).toHaveLength(step === 1 ? 2 : 3)
    }
  })

  it('counts syllables up to 3 at step 4 and up to 4 later, with a four at step 5', () => {
    for (const [step, tasks] of sessions()) {
      const counts = tasks.flatMap(t => (t.type === 'syllables' ? [t.answer] : []))
      for (const c of counts) expect(c).toBeLessThanOrEqual(step === 4 ? 3 : 4)
      for (const t of tasks) if (t.type === 'syllables') expect(t.answer).toBe(t.word.syllables.length)
      if (step === 5) expect(counts).toContain(4)
    }
  })

  it('gives exactly one right picture: the others share neither rhyme nor first sound', () => {
    const shares = (a: Word, b: Word) =>
      (a.rhyme !== undefined && a.rhyme === b.rhyme) || (a.sound !== undefined && a.sound === b.sound)
    for (const [, tasks] of sessions()) {
      for (const t of tasks) {
        if (t.type === 'syllables') continue
        const right = t.choices.filter(c => (t.type === 'rhyme' ? c.rhyme === t.word.rhyme : c.sound === t.word.sound))
        expect(right.map(c => c.id)).toEqual([t.answer])
        expect(t.choices.filter(c => shares(c, t.word)).map(c => c.id)).toEqual([t.answer])
        expect(new Set([t.word.id, ...t.choices.map(c => c.id)]).size).toBe(t.choices.length + 1)
      }
    }
  })

  it('never offers a wrong picture that starts the way the asked word does (Stein in a Sch task, Auto in an A task)', () => {
    for (const [, tasks] of sessions()) {
      for (const t of tasks) {
        if (t.type !== 'sound') continue
        for (const c of t.choices) if (c.id !== t.answer) expect(c.start, `${t.word.id}: ${c.id}`).not.toBe(t.word.start)
      }
    }
    const start = (id: string) => WORDS.find(w => w.id === id)?.start
    expect([start('stein'), start('schuh'), start('strand')]).toEqual(['Sch', 'Sch', 'Sch'])
    expect(start('auto')).toBe(start('apfel'))
  })

  it('says syllables as they sound, not as letters to spell', () => {
    const word = (id: string) => WORDS.find(w => w.id === id) as Word
    expect(spokenSyllables(word('socke'))).toBe('So – ke')
    expect(spokenSyllables(word('banane'))).toBe('Ba – na – ne')
  })

  it('names nothing a Swiss child calls otherwise, and no picture an older iPad lacks', () => {
    const ids = WORDS.map(w => w.id)
    for (const id of ['muetze', 'eis', 'krankenwagen', 'ziege', 'dose', 'nest']) expect(ids).not.toContain(id)
  })

  it('puts the right picture in different places', () => {
    const places = new Set<number>()
    for (const [, tasks] of sessions()) for (const t of tasks) if (t.type !== 'syllables') places.add(t.choices.findIndex(c => c.id === t.answer))
    expect(places).toEqual(new Set([0, 1, 2]))
  })

  it('asks no word twice in a visit', () => {
    for (const [, tasks] of sessions()) expect(new Set(tasks.map(t => t.word.id)).size).toBe(5)
  })
})

describe('the example', () => {
  it('shows one until two visits are done at the step, never at fertig', () => {
    expect(exampleFor(1, 0)?.kind).toBe('rhyme')
    expect(exampleFor(2, 9)?.kind).toBe('rhyme')
    expect(exampleFor(3, 5)?.kind).toBe('sound')
    expect(exampleFor(4, 0)).toMatchObject({ kind: 'syllables', beats: 3 })
    expect(exampleFor(5, 0)).toMatchObject({ kind: 'syllables', beats: 4 })
    expect(exampleFor(2, 10)).toBeNull()
    expect(exampleFor(6, 0)).toBeNull()
  })

  it('says the examples the design gives', () => {
    expect(exampleFor(1, 0)?.text).toBe('Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!')
    expect(exampleFor(1, 0)?.words.map(w => w.id)).toEqual(['maus', 'haus'])
    expect(exampleFor(3, 0)?.text).toBe('Sonne – Sofa. Sonne, Sofa: die fangen gleich an!')
    expect(exampleFor(4, 0)?.text).toBe('Ba – na – ne. Hör mal: Ba – na – ne. Drei Silben. Ich trommle mit:')
    expect(exampleFor(5, 0)?.text).toBe(
      'Scho – ko – la – de. Hör mal: Scho – ko – la – de. Vier Silben. Ich trommle mit:',
    )
  })
})
