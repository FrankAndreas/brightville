import { describe, expect, it } from 'vitest'
import {
  answerChoices, buildLadderSession, countable, stepRange, cheerText, dicePips, looseLayout, numberWord, questionText, seededRandom,
  type Task,
} from './numbers'

const apple = { emoji: '🍎', one: 'ein Apfel', many: 'Äpfel' }

describe('numberWord', () => {
  it('names 0 to 20 in German', () => {
    expect([0, 1, 2, 5, 9, 12, 20].map(numberWord)).toEqual(['null', 'eins', 'zwei', 'fünf', 'neun', 'zwölf', 'zwanzig'])
  })
})

describe('seededRandom', () => {
  it('repeats the same numbers in [0, 1) for the same seed', () => {
    const a = seededRandom(7), b = seededRandom(7), c = seededRandom(8)
    const run = (r: () => number) => Array.from({ length: 20 }, r)
    const first = run(a)
    expect(run(b)).toEqual(first)
    expect(run(c)).not.toEqual(first)
    for (const n of first) expect(n >= 0 && n < 1).toBe(true)
  })
})

describe('answerChoices', () => {
  it('gives 3 distinct near choices including the answer, within min..max', () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = seededRandom(seed)
      const answer = seed % 10
      const choices = answerChoices(answer, 9, random)
      expect(choices).toHaveLength(3)
      expect(new Set(choices).size).toBe(3)
      expect(choices).toContain(answer)
      for (const c of choices) expect(c >= 0 && c <= 9 && Math.abs(c - answer) <= 2).toBe(true)
    }
  })

  it('never offers less than min', () => {
    for (let seed = 0; seed < 50; seed++) expect(Math.min(...answerChoices(1, 9, seededRandom(seed), 1))).toBe(1)
  })

  it('does not always put the answer first', () => {
    const positions = new Set(Array.from({ length: 50 }, (_, seed) => answerChoices(5, 9, seededRandom(seed)).indexOf(5)))
    expect(positions.size).toBe(3)
  })
})

describe('looseLayout', () => {
  it('places up to 10 objects inside the field without overlap', () => {
    for (let n = 0; n <= 10; n++) {
      const spots = looseLayout(n, seededRandom(n))
      expect(spots).toHaveLength(n)
      for (const s of spots) expect(s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1).toBe(true)
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        expect(Math.max(Math.abs(spots[i].x - spots[j].x) * 4, Math.abs(spots[i].y - spots[j].y) * 3)).toBeGreaterThan(0.6)
      }
    }
  })
})

describe('looseLayout up to 20', () => {
  it('places up to 20 objects inside the field, each in its own cell', () => {
    for (let n = 11; n <= 20; n++) {
      const spots = looseLayout(n, seededRandom(n))
      expect(spots).toHaveLength(n)
      for (const s of spots) expect(s.x > 0 && s.x < 1 && s.y > 0 && s.y < 1).toBe(true)
      const cells = new Set(spots.map(s => `${Math.floor(s.x * 5)},${Math.floor(s.y * 4)}`))
      expect(cells.size).toBe(n)
      // Less jitter on the finer grid: a thing nearly fills its cell
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        expect(Math.max(Math.abs(spots[i].x - spots[j].x) * 5, Math.abs(spots[i].y - spots[j].y) * 4)).toBeGreaterThan(0.82)
      }
    }
  })
})

describe('dicePips', () => {
  it('has the standard faces', () => {
    for (let v = 1; v <= 6; v++) expect(dicePips(v)).toHaveLength(v)
    expect(dicePips(1)).toEqual([{ x: 1, y: 1 }])
    expect(dicePips(5)).toContainEqual({ x: 1, y: 1 })
    expect(dicePips(6)).not.toContainEqual({ x: 1, y: 1 })
  })
})

describe('speech', () => {
  it('asks in German with number words', () => {
    expect(questionText({ type: 'count', ladder: 'zaehlen', kind: 0, amount: 4, answer: 4, choices: [] }, apple)).toBe('Wie viele Äpfel?')
    expect(questionText({ type: 'dice', ladder: 'zaehlen', kind: 0, dice: [3], answer: 3, choices: [] }, apple)).toBe('Wie viele Punkte?')
    expect(questionText({ type: 'plus', ladder: 'rechnen', kind: 0, a: 1, b: 3, answer: 4, choices: [] }, apple))
      .toBe('ein Apfel und drei Äpfel. Wie viele zusammen?')
  })

  it('cheers with the number', () => {
    expect(cheerText(5)).toBe('Super! Fünf!')
    expect(cheerText(0)).toBe('Super! Null!')
  })
})

describe('numberWord up to 100', () => {
  it('names the numbers above 20', () => {
    expect([21, 30, 45, 99, 100].map(numberWord)).toEqual(['einundzwanzig', 'dreißig', 'fünfundvierzig', 'neunundneunzig', 'hundert'])
  })
})

describe('buildLadderSession', () => {
  const tasksAt = (zaehlen: number, rechnen: number, seed: number) => buildLadderSession({ zaehlen, rechnen }, 3, seededRandom(seed))

  it('asks three Zählen tasks, then two Rechnen tasks', () => {
    const tasks = tasksAt(2, 2, 1)
    expect(tasks.map(t => t.ladder)).toEqual(['zaehlen', 'zaehlen', 'zaehlen', 'rechnen', 'rechnen'])
  })

  it('makes valid tasks at every step', () => {
    for (let step = 1; step <= 6; step++) {
      for (let seed = 0; seed < 200; seed++) {
        for (const t of tasksAt(step, step, seed)) {
          const max = stepRange(t.ladder, step)
          expect(t.choices).toHaveLength(3)
          expect(new Set(t.choices).size).toBe(3)
          expect(t.choices).toContain(t.answer)
          for (const c of t.choices) expect(c >= 0 && c <= max).toBe(true)
          if (t.type === 'minus') expect(t.a - t.b).toBeGreaterThanOrEqual(1)
          if (t.type === 'flash') expect(t.amount >= 1 && t.amount <= 5).toBe(true)
          if (t.type === 'bars') expect(t.amount >= 21 && t.amount <= 100).toBe(true)
          if (t.type === 'next') {
            expect(t.shown).toEqual([t.from, t.from + t.by, t.from + 2 * t.by])
            expect(t.answer).toBe(t.from + 3 * t.by)
            for (const n of t.shown) expect(n).toBeGreaterThanOrEqual(0)
          }
          if (step >= 5 && t.ladder === 'rechnen' && (t.type === 'plus' || t.type === 'minus')) {
            expect(t.bars).toBe(true)
            if (t.type === 'plus') expect((t.a % 10) + (t.b % 10)).toBeLessThanOrEqual(9)
            else expect(t.a % 10).toBeGreaterThanOrEqual(t.b % 10)
          }
        }
      }
    }
  })

  it('keeps each step within its numbers', () => {
    expect([1, 2, 3, 4, 5, 6].map(s => stepRange('zaehlen', s))).toEqual([10, 20, 20, 100, 100, 100])
    expect([1, 2, 3, 4, 5, 6].map(s => stepRange('rechnen', s))).toEqual([5, 10, 10, 20, 100, 100])
    for (let seed = 0; seed < 200; seed++) {
      const [z1, , , r1] = tasksAt(1, 1, seed)
      expect(z1.answer).toBeLessThanOrEqual(10)
      expect(r1.answer).toBeLessThanOrEqual(5)
    }
  })

  it('brings the new kinds of task at their steps', () => {
    const kinds = (z: number, r: number) => {
      const seen = new Set<string>()
      for (let seed = 0; seed < 100; seed++) for (const t of tasksAt(z, r, seed)) seen.add(`${t.ladder}:${t.type}`)
      return seen
    }
    expect(kinds(1, 1)).toEqual(new Set(['zaehlen:count', 'zaehlen:dice', 'rechnen:plus']))
    expect(kinds(3, 3)).toEqual(new Set(['zaehlen:next', 'zaehlen:flash', 'rechnen:plus', 'rechnen:minus']))
    expect(kinds(4, 4).has('zaehlen:bars')).toBe(true)
  })

  it('speaks counting on and taking away', () => {
    const next: Task = { type: 'next', ladder: 'zaehlen', kind: 0, from: 7, by: -1, shown: [7, 6, 5], answer: 4, choices: [3, 4, 5] }
    expect(questionText(next, apple)).toContain('sieben, sechs, fünf')
    const minus: Task = { type: 'minus', ladder: 'rechnen', kind: 0, a: 5, b: 2, answer: 3, choices: [2, 3, 4] }
    expect(questionText(minus, apple)).toContain('weg')
    // What is left is counted: the ones gone away are not
    expect(countable(minus)).toBe(3)
  })
})
