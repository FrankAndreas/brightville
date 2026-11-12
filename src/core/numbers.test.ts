import { describe, expect, it } from 'vitest'
import {
  SESSION_LENGTH, answerChoices, buildSession, cheerText, dicePips, looseLayout, numberWord, questionText, seededRandom,
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

describe('dicePips', () => {
  it('has the standard faces', () => {
    for (let v = 1; v <= 6; v++) expect(dicePips(v)).toHaveLength(v)
    expect(dicePips(1)).toEqual([{ x: 1, y: 1 }])
    expect(dicePips(5)).toContainEqual({ x: 1, y: 1 })
    expect(dicePips(6)).not.toContainEqual({ x: 1, y: 1 })
  })
})

describe('buildSession', () => {
  const sessions = Array.from({ length: 300 }, (_, seed) => buildSession(6, seededRandom(seed)))

  it('has 5 tasks: a small count first, then one count, one dice and two plus', () => {
    expect(SESSION_LENGTH).toBe(5)
    for (const tasks of sessions) {
      expect(tasks).toHaveLength(5)
      expect(tasks[0].type).toBe('count')
      expect(tasks[0].answer >= 1 && tasks[0].answer <= 5).toBe(true)
      expect(tasks.slice(1).map(t => t.type).sort()).toEqual(['count', 'dice', 'plus', 'plus'])
    }
  })

  it('does not always use the same order', () => {
    expect(new Set(sessions.map(tasks => tasks.map(t => t.type).join())).size).toBeGreaterThan(3)
  })

  it('keeps every answer countable: 0 to 9, and consistent with what is shown', () => {
    for (const task of sessions.flat()) {
      expect(task.answer >= 0 && task.answer <= 9).toBe(true)
      if (task.type === 'count') expect(task.amount).toBe(task.answer)
      if (task.type === 'dice') {
        expect(task.dice).toHaveLength(1)
        expect(task.dice[0] >= 1 && task.dice[0] <= 6).toBe(true)
        expect(task.answer).toBe(task.dice[0])
      }
      if (task.type === 'plus') {
        expect(task.a >= 1 && task.b >= 1).toBe(true)
        expect(task.a + task.b).toBe(task.answer)
      }
      expect(task.kind >= 0 && task.kind < 6).toBe(true)
    }
  })

  it('offers 3 distinct choices with the answer; 0 only when counting objects', () => {
    for (const task of sessions.flat()) {
      expect(new Set(task.choices).size).toBe(3)
      expect(task.choices).toContain(task.answer)
      for (const c of task.choices) expect(c <= 9).toBe(true)
      if (task.type !== 'count') expect(Math.min(...task.choices)).toBeGreaterThanOrEqual(1)
    }
  })

  it('sometimes asks for zero, but never in the first task', () => {
    const later = sessions.flatMap(tasks => tasks.slice(1)).filter((t): t is Extract<Task, { type: 'count' }> => t.type === 'count')
    expect(later.some(t => t.amount === 0)).toBe(true)
    expect(sessions.every(tasks => tasks[0].answer > 0)).toBe(true)
  })
})

describe('speech', () => {
  it('asks in German with number words', () => {
    expect(questionText({ type: 'count', kind: 0, amount: 4, answer: 4, choices: [] }, apple)).toBe('Wie viele Äpfel?')
    expect(questionText({ type: 'dice', kind: 0, dice: [3], answer: 3, choices: [] }, apple)).toBe('Wie viele Punkte?')
    expect(questionText({ type: 'plus', kind: 0, a: 1, b: 3, answer: 4, choices: [] }, apple))
      .toBe('ein Apfel und drei Äpfel. Wie viele zusammen?')
  })

  it('cheers with the number', () => {
    expect(cheerText(5)).toBe('Super! Fünf!')
    expect(cheerText(0)).toBe('Super! Null!')
  })
})
