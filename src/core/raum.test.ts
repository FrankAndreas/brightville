import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import { buildRaumSession, exampleFor, placeForAll, setupFor, taskText, TWO_CLUES, zoneWidth, type RaumTask } from './raum'
import { CAR, delta, holds, OBJECTS, placeFor, startArrangement, type Arrangement } from './world'

const sessions = function* (): Generator<[number, RaumTask[]]> {
  for (let seed = 0; seed < 300; seed++) {
    const step = 1 + (seed % 6)
    yield [step, buildRaumSession(step, seededRandom(seed))]
  }
}
const ONE: Record<number, string[]> = {
  1: ['auf', 'unter', 'in'], 2: ['neben', 'vor', 'hinter'], 4: ['links neben', 'rechts neben'],
}

describe('a Spielwelt visit', () => {
  it('asks two finding and three placing tasks', () => {
    for (const [, tasks] of sessions()) {
      expect(tasks).toHaveLength(5)
      expect(tasks.filter(t => t.type === 'find')).toHaveLength(2)
    }
  })

  it('uses the step\'s words', () => {
    for (const [step, tasks] of sessions()) {
      const words = tasks.flatMap(t => t.clues.map(c => c.word))
      if (ONE[step]) for (const w of words) expect(ONE[step]).toContain(w)
      if (step === 3) {
        expect(words.filter(w => w === 'zwischen')).toHaveLength(2)
        for (const w of words) expect([...ONE[1], ...ONE[2], 'zwischen']).toContain(w)
      }
      if (step === 5) for (const t of tasks) expect(t.clues).toHaveLength(2)
      if (step <= 4) for (const t of tasks) expect(t.clues).toHaveLength(1)
    }
  })

  it('never uses the car, and never a thing twice in a row', () => {
    for (const [, tasks] of sessions()) {
      for (const t of tasks) for (const c of t.clues) expect([c.object, c.other]).not.toContain(CAR)
      for (let i = 1; i < tasks.length; i++) expect(tasks[i].thing).not.toBe(tasks[i - 1].thing)
    }
  })

  it('pairs two clues only where both are true on a spot wide enough for a finger', () => {
    expect(TWO_CLUES.length).toBeGreaterThanOrEqual(4)
    for (const clues of TWO_CLUES) expect(zoneWidth(clues), JSON.stringify(clues)).toBeGreaterThanOrEqual(10)
    for (const clues of TWO_CLUES) {
      const place = placeForAll(clues)
      expect(place, JSON.stringify(clues)).not.toBeNull()
      for (const c of clues) expect(holds(place!, c)).toBe(true)
    }
  })

  it('says each task in a whole sentence with the right pronoun', () => {
    expect(taskText({ type: 'place', thing: 'ball', clues: [{ word: 'auf', object: 'bett' }] })).toBe('Leg den Ball auf das Bett.')
    expect(taskText({ type: 'find', thing: 'katze', clues: [{ word: 'unter', object: 'tisch' }] })).toBe('Die Katze ist unter dem Tisch. Findest du sie?')
    expect(taskText({ type: 'find', thing: 'buch', clues: [{ word: 'in', object: 'schrank' }] })).toBe('Das Buch ist im Schrank. Findest du es?')
    expect(taskText({ type: 'find', thing: 'hut', clues: [{ word: 'hinter', object: 'busch' }, { word: 'rechts neben', object: 'stein' }] }))
      .toBe('Der Hut ist hinter dem Busch, rechts neben dem Stein. Findest du ihn?')
    expect(taskText({ type: 'place', thing: 'ente', clues: [{ word: 'zwischen', object: 'baum', other: 'bank' }] }))
      .toBe('Leg die Ente zwischen den Baum und die Bank.')
  })
})

describe('getting a task ready', () => {
  const view = 300

  it('hides the thing to find where the clues are true', () => {
    for (const [step, tasks] of sessions()) {
      for (const t of tasks.filter(x => x.type === 'find')) {
        const a = setupFor(t, startArrangement(), view, step)
        for (const c of t.clues) expect(holds(a[t.thing], c), `${t.thing} ${JSON.stringify(c)}`).toBe(true)
      }
    }
  })

  it('puts the thing to carry where no clue is true yet, on the object\'s screen at steps 1–3, on the ground', () => {
    for (const [step, tasks] of sessions()) {
      for (const t of tasks.filter(x => x.type === 'place')) {
        const a = setupFor(t, startArrangement(), view, step)
        const p = a[t.thing]
        expect(t.clues.some(c => holds(p, c)), JSON.stringify(t)).toBe(false)
        expect(p.on ?? p.inside ?? p.under).toBeUndefined()
        const at = OBJECTS.find(o => o.id === t.clues[0].object)!.x
        if (step <= 3) expect(Math.abs(delta(at, p.x))).toBeLessThanOrEqual(60)
        // Later it starts in the middle of the view she has: she carries it to the object
        else expect(Math.abs(delta(view, p.x))).toBeLessThanOrEqual(60)
      }
    }
  })

  it('moves another thing off the spot where the thing to find goes, so it can be seen', () => {
    const t: RaumTask = { type: 'find', thing: 'teddy', clues: [{ word: 'vor', object: 'baum' }] }
    const before = { ...startArrangement(), ente: placeFor({ word: 'vor', object: 'baum' }) }
    const after = setupFor(t, before, view, 2)
    expect(Math.abs(delta(after.ente.x, after.teddy.x))).toBeGreaterThanOrEqual(10)
  })

  it('moves only the task\'s thing', () => {
    const before: Arrangement = startArrangement()
    const t: RaumTask = { type: 'place', thing: 'ball', clues: [{ word: 'auf', object: 'tisch' }] }
    const after = setupFor(t, before, view, 1)
    for (const id of Object.keys(before)) if (id !== 'ball') expect(after[id]).toEqual(before[id])
  })
})

describe('the example', () => {
  it('comes until two visits are done at the step, never at fertig, and shows true places', () => {
    expect(exampleFor(6, 0)).toBeNull()
    expect(exampleFor(2, 10)).toBeNull()
    for (let step = 1; step <= 5; step++) {
      const ex = exampleFor(step, 0)!
      expect(ex.lines.length).toBeGreaterThanOrEqual(1)
      for (const line of ex.lines) expect(line.place).toBeDefined()
    }
    expect(exampleFor(1, 0)!.lines.map(l => l.text)).toEqual(['Schau: Der Ball ist auf dem Tisch.', 'Jetzt ist er unter dem Tisch.'])
  })
})
