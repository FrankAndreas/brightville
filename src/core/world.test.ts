import { describe, expect, it } from 'vitest'
import {
  CAR, describe as describePlace, delta, GROUND, holds, nounPhrase, objectsWith, OBJECTS, placeFor, prepPhrase, settle,
  startArrangement, THINGS, WORLD_WIDTH, PAIRS, type Clue, type Place, type Word,
} from './world'

const obj = (id: string) => OBJECTS.find(o => o.id === id) ?? (() => { throw new Error(id) })()
const words = (id: string): Word[] => {
  const o = obj(id)
  return [
    ...(o.top !== null ? ['auf' as const] : []), ...(o.under ? ['unter' as const] : []), ...(o.container ? ['in' as const] : []),
    'neben', 'vor', 'hinter', 'links neben', 'rechts neben',
  ]
}

describe('the world\'s German', () => {
  it('says things and objects with their article in every case', () => {
    expect(nounPhrase(obj('bett'), 'acc')).toBe('das Bett')
    expect(nounPhrase(obj('tisch'), 'dat')).toBe('dem Tisch')
    expect(nounPhrase(obj('bank'), 'dat')).toBe('der Bank')
    expect(nounPhrase(THINGS.find(t => t.id === 'ball')!, 'nom')).toBe('der Ball')
  })

  it('puts the right case after each word, and "im" and "ins"', () => {
    expect(prepPhrase({ word: 'auf', object: 'bett' }, 'acc')).toBe('auf das Bett')
    expect(prepPhrase({ word: 'auf', object: 'bett' }, 'dat')).toBe('auf dem Bett')
    expect(prepPhrase({ word: 'in', object: 'schrank' }, 'dat')).toBe('im Schrank')
    expect(prepPhrase({ word: 'in', object: 'schrank' }, 'acc')).toBe('in den Schrank')
    expect(prepPhrase({ word: 'in', object: 'kiste' }, 'acc')).toBe('in die Kiste')
    expect(prepPhrase({ word: 'in', object: CAR }, 'acc')).toBe('ins Auto')
    expect(prepPhrase({ word: 'in', object: CAR }, 'dat')).toBe('im Auto')
    expect(prepPhrase({ word: 'unter', object: 'bank' }, 'dat')).toBe('unter der Bank')
    expect(prepPhrase({ word: 'zwischen', object: 'baum', other: 'bank' }, 'dat')).toBe('zwischen dem Baum und der Bank')
    expect(prepPhrase({ word: 'zwischen', object: 'baum', other: 'bank' }, 'acc')).toBe('zwischen den Baum und die Bank')
    expect(prepPhrase({ word: 'links neben', object: 'baum' }, 'acc')).toBe('links neben den Baum')
    expect(prepPhrase({ word: 'hinter', object: 'busch' }, 'dat')).toBe('hinter dem Busch')
  })
})

describe('where a dropped thing comes to rest', () => {
  it('lies on a surface it was dropped above', () => {
    const t = obj('tisch')
    expect(settle(t.x, (t.top ?? 0) - 6)).toMatchObject({ on: 'tisch', y: t.top })
  })

  it('lies under something with room under it, and in a container', () => {
    const t = obj('tisch')
    expect(settle(t.x, GROUND - 3)).toMatchObject({ under: 'tisch', y: GROUND })
    const k = obj('kiste')
    expect(settle(k.x, GROUND - 4)).toMatchObject({ inside: 'kiste' })
  })

  it('stands on the ground otherwise, on the back lane a little higher and the front lane a little lower', () => {
    expect(settle(172, GROUND)).toMatchObject({ lane: 'mid', y: GROUND })
    expect(settle(172, GROUND - 6)).toMatchObject({ lane: 'back' })
    expect(settle(172, GROUND + 7)).toMatchObject({ lane: 'front' })
    const b = obj('baum')
    expect(settle(b.x, GROUND - 6)).toMatchObject({ lane: 'back' })
    // Dropped in the middle of the tree: in front of it
    expect(settle(b.x, GROUND)).toMatchObject({ lane: 'front' })
  })

  it('never ends up outside the world', () => {
    expect(settle(-5, GROUND).x).toBeGreaterThanOrEqual(0)
    expect(settle(WORLD_WIDTH + 5, GROUND).x).toBeLessThan(WORLD_WIDTH)
  })
})

describe('which words are true', () => {
  it('finds a place for every word every object takes, and that place holds', () => {
    for (const o of OBJECTS) {
      for (const word of words(o.id)) {
        const clue: Clue = { word, object: o.id }
        expect(holds(placeFor(clue), clue), `${word} ${o.id}`).toBe(true)
      }
    }
    for (const [a, b] of PAIRS) {
      const clue: Clue = { word: 'zwischen', object: a, other: b }
      expect(holds(placeFor(clue), clue), `zwischen ${a} ${b}`).toBe(true)
    }
  })

  it('tells left from right on the screen, and neben from far away', () => {
    const b = obj('baum')
    const left: Place = { x: b.x - b.w / 2 - 6, y: GROUND, lane: 'mid' }
    expect(holds(left, { word: 'links neben', object: 'baum' })).toBe(true)
    expect(holds(left, { word: 'rechts neben', object: 'baum' })).toBe(false)
    expect(holds(left, { word: 'neben', object: 'baum' })).toBe(true)
    expect(holds({ x: b.x - 80, y: GROUND, lane: 'mid' }, { word: 'neben', object: 'baum' })).toBe(false)
  })

  it('knows vor and hinter by the lane, only overlapping the object', () => {
    const b = obj('busch')
    expect(holds({ x: b.x, y: GROUND + 8, lane: 'front' }, { word: 'vor', object: 'busch' })).toBe(true)
    expect(holds({ x: b.x, y: GROUND - 6, lane: 'back' }, { word: 'hinter', object: 'busch' })).toBe(true)
    expect(holds({ x: b.x, y: GROUND - 6, lane: 'back' }, { word: 'vor', object: 'busch' })).toBe(false)
    expect(holds({ x: b.x + 40, y: GROUND - 6, lane: 'back' }, { word: 'hinter', object: 'busch' })).toBe(false)
  })

  it('takes the wrap-around: the end of the world is next to its start', () => {
    expect(delta(WORLD_WIDTH - 5, 5)).toBe(10)
    expect(delta(5, WORLD_WIDTH - 5)).toBe(-10)
    const last = OBJECTS.reduce((a, b) => (a.x > b.x ? a : b))
    const right: Place = { x: (last.x + last.w / 2 + 6) % WORLD_WIDTH, y: GROUND, lane: 'mid' }
    expect(holds(right, { word: 'rechts neben', object: last.id })).toBe(true)
  })

  it('lets the car carry what is on it and in it', () => {
    const moved = objectsWith(500)
    const car = moved.find(o => o.id === CAR)
    expect(car?.x).toBe(500)
    const onCar: Place = { x: 0, y: 0, lane: 'mid', on: CAR }
    expect(holds(onCar, { word: 'auf', object: CAR }, moved)).toBe(true)
  })
})

describe('saying where a thing is', () => {
  it('names the closest object with a true word, in a whole sentence', () => {
    const bett = obj('bett')
    expect(describePlace('ball', { x: bett.x + bett.w / 2 + 6, y: GROUND, lane: 'mid' })).toBe('Der Ball ist jetzt neben dem Bett.')
    expect(describePlace('katze', { x: 0, y: 0, lane: 'mid', inside: 'kiste' })).toBe('Die Katze ist jetzt in der Kiste.')
    expect(describePlace('buch', { x: 0, y: 0, lane: 'mid', on: 'tisch' })).toBe('Das Buch ist jetzt auf dem Tisch.')
  })
})

describe('the start', () => {
  it('puts every thing on the ground, apart from the objects and from each other', () => {
    const a = startArrangement()
    expect(Object.keys(a).sort()).toEqual(THINGS.map(t => t.id).sort())
    for (const [id, p] of Object.entries(a)) {
      expect(p, id).toMatchObject({ lane: 'mid', y: GROUND })
      for (const o of OBJECTS) expect(Math.abs(delta(o.x, p.x)), `${id} ${o.id}`).toBeGreaterThan(o.w / 2 + 4)
    }
    const xs = Object.values(a).map(p => p.x).sort((x, y) => x - y)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(10)
  })
})
