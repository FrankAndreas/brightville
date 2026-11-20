// The Spielwelt's world: a wide side-on landscape that wraps around, the objects in it (which don't move, except the
// car), the things she carries, where a dropped thing comes to rest and which position words are true
// (Lehrplan 21 MA.2, Zugang 4). Units: the view is 100 high; y grows downwards; the ground line is at GROUND.

export type Gender = 'm' | 'f' | 'n'
export type Kase = 'nom' | 'acc' | 'dat'

export interface WorldObject {
  id: string
  noun: string
  gender: Gender
  /** Centre, width and height above the ground line */
  x: number
  w: number
  h: number
  /** Where things rest on it (auf); null: nothing rests on it */
  top: number | null
  /** Room under it (unter) */
  under: boolean
  /** Things go in it (in) */
  container: boolean
}

export interface Thing { id: string; noun: string; gender: Gender; emoji: string }

/** Where a thing is: on the ground in a lane, or on, in or under an object */
export interface Place {
  x: number
  y: number
  lane: 'back' | 'mid' | 'front'
  on?: string
  inside?: string
  under?: string
}
export type Arrangement = Record<string, Place>

export type Word = 'auf' | 'unter' | 'in' | 'neben' | 'vor' | 'hinter' | 'zwischen' | 'links neben' | 'rechts neben'
/** One position: a word and its object (zwischen: and the second object) */
export interface Clue { word: Word; object: string; other?: string }

export const WORLD_WIDTH = 900
export const GROUND = 80
export const BACK_LANE = 74
export const FRONT_LANE = 88
/** Half a thing's width */
const HALF = 5
/** How far from an object's side a thing still stands "neben" it */
const NEXT_TO = 12
/** How far from each a thing "zwischen" two objects may be */
const BETWEEN = 20
export const CAR = 'auto'

const o = (id: string, noun: string, gender: Gender, x: number, w: number, h: number, top: number | null,
  under = false, container = false): WorldObject => ({ id, noun, gender, x, w, h, top, under, container })

/** From the left: the house, the garden, the pond, the playground, the street, the meadow */
export const OBJECTS: WorldObject[] = [
  o('bett', 'Bett', 'n', 28, 36, 14, 66, true),
  o('tisch', 'Tisch', 'm', 76, 26, 16, 64, true),
  o('schrank', 'Schrank', 'm', 118, 22, 40, 40, false, true),
  o('kiste', 'Kiste', 'f', 152, 16, 10, 70, false, true),
  o('baum', 'Baum', 'm', 200, 30, 60, null),
  o('bank', 'Bank', 'f', 245, 30, 10, 70, true),
  o('zaun', 'Zaun', 'm', 295, 30, 14, null),
  o('bruecke', 'Brücke', 'f', 395, 60, 8, 72, true),
  o('rutschbahn', 'Rutschbahn', 'f', 510, 34, 26, 54, true),
  o('sandkasten', 'Sandkasten', 'm', 565, 34, 6, null, false, true),
  o('schaukel', 'Schaukel', 'f', 612, 24, 34, 66),
  o('garage', 'Garage', 'f', 670, 40, 36, null, false, true),
  o(CAR, 'Auto', 'n', 730, 30, 14, 66, false, true),
  o('stein', 'Stein', 'm', 805, 22, 10, 70),
  o('busch', 'Busch', 'm', 845, 28, 18, null),
  o('hundehuette', 'Hundehütte', 'f', 885, 24, 20, 60, false, true),
]

/** Pairs that stand close enough for a thing "zwischen" them */
export const PAIRS: [string, string][] = [
  ['bett', 'tisch'], ['tisch', 'schrank'], ['schrank', 'kiste'], ['baum', 'bank'], ['bank', 'zaun'],
  ['rutschbahn', 'sandkasten'], ['sandkasten', 'schaukel'], ['stein', 'busch'], ['busch', 'hundehuette'],
]

export const THINGS: Thing[] = [
  { id: 'ball', noun: 'Ball', gender: 'm', emoji: '⚽' },
  { id: 'teddy', noun: 'Teddy', gender: 'm', emoji: '🧸' },
  { id: 'katze', noun: 'Katze', gender: 'f', emoji: '🐱' },
  { id: 'ente', noun: 'Ente', gender: 'f', emoji: '🦆' },
  { id: 'eimer', noun: 'Eimer', gender: 'm', emoji: '🪣' },
  { id: 'buch', noun: 'Buch', gender: 'n', emoji: '📖' },
  { id: 'hut', noun: 'Hut', gender: 'm', emoji: '🎩' },
  { id: 'apfel', noun: 'Apfel', gender: 'm', emoji: '🍎' },
]

const START_X: Record<string, number> = { ball: 172, teddy: 320, katze: 345, ente: 445, eimer: 470, buch: 632, hut: 765, apfel: 780 }

/** Every thing on the ground, apart from the objects */
export function startArrangement(): Arrangement {
  return Object.fromEntries(THINGS.map(t => [t.id, { x: START_X[t.id], y: GROUND, lane: 'mid' as const }]))
}

/** The objects with the car where she drove it */
export const objectsWith = (carX: number): WorldObject[] => OBJECTS.map(x => (x.id === CAR ? { ...x, x: wrap(carX) } : x))

export const wrap = (x: number) => ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH
/** From a to b the short way round: negative when b is to the left */
export function delta(a: number, b: number): number {
  const d = wrap(b - a)
  return d > WORLD_WIDTH / 2 ? d - WORLD_WIDTH : d
}

const find = (id: string, objects: WorldObject[]) => objects.find(x => x.id === id)
const overlaps = (x: number, obj: WorldObject) => Math.abs(delta(obj.x, x)) < obj.w / 2 + HALF - 1
/** Space between the thing and the object's side; negative when they overlap */
const gap = (x: number, obj: WorldObject) => Math.abs(delta(obj.x, x)) - obj.w / 2 - HALF
const onGround = (p: Place) => !p.on && !p.inside && !p.under

/** Where a thing dropped at (x, y) comes to rest */
export function settle(x: number, y: number, objects: WorldObject[] = OBJECTS): Place {
  const at = wrap(x)
  for (const obj of objects) {
    if (Math.abs(delta(obj.x, at)) > obj.w / 2) continue
    if (obj.top !== null && y <= obj.top + 3 && y >= obj.top - 30) return { x: at, y: obj.top, lane: 'mid', on: obj.id }
    if (obj.container && y >= GROUND - obj.h - 2 && y <= GROUND + 2) return { x: at, y: GROUND, lane: 'mid', inside: obj.id }
    if (obj.under && obj.top !== null && y > obj.top + 3 && y <= GROUND + 2) return { x: at, y: GROUND, lane: 'mid', under: obj.id }
  }
  if (y < GROUND - 3) return { x: at, y: BACK_LANE, lane: 'back' }
  if (y > GROUND + 3) return { x: at, y: FRONT_LANE, lane: 'front' }
  // On the objects' own line it would stand inside one: it stands in front
  if (objects.some(obj => overlaps(at, obj))) return { x: at, y: FRONT_LANE, lane: 'front' }
  return { x: at, y: GROUND, lane: 'mid' }
}

/** Whether the clue is true of a thing at `place` */
export function holds(place: Place, clue: Clue, objects: WorldObject[] = OBJECTS): boolean {
  const obj = find(clue.object, objects)
  if (!obj) return false
  switch (clue.word) {
    case 'auf': return place.on === obj.id
    case 'in': return place.inside === obj.id
    case 'unter': return place.under === obj.id
    case 'vor': return onGround(place) && place.lane === 'front' && overlaps(place.x, obj)
    case 'hinter': return onGround(place) && place.lane === 'back' && overlaps(place.x, obj)
    case 'neben': return onGround(place) && gap(place.x, obj) >= -1 && gap(place.x, obj) <= NEXT_TO
    case 'links neben': return holds(place, { word: 'neben', object: obj.id }, objects) && delta(obj.x, place.x) < 0
    case 'rechts neben': return holds(place, { word: 'neben', object: obj.id }, objects) && delta(obj.x, place.x) > 0
    case 'zwischen': {
      const other = clue.other ? find(clue.other, objects) : undefined
      if (!other || !onGround(place)) return false
      const sides = Math.sign(delta(obj.x, place.x)) !== Math.sign(delta(other.x, place.x))
      return sides && [obj, other].every(b => gap(place.x, b) >= -1 && gap(place.x, b) <= BETWEEN)
    }
  }
}

/** A spot where the clue is true */
export function placeFor(clue: Clue, objects: WorldObject[] = OBJECTS): Place {
  const obj = find(clue.object, objects)
  if (!obj) throw new Error(`no object ${clue.object}`)
  const beside = (side: 1 | -1): Place => ({ x: wrap(obj.x + side * (obj.w / 2 + HALF + 3)), y: GROUND, lane: 'mid' })
  switch (clue.word) {
    case 'auf': return { x: obj.x, y: obj.top ?? GROUND, lane: 'mid', on: obj.id }
    case 'in': return { x: obj.x, y: GROUND, lane: 'mid', inside: obj.id }
    case 'unter': return { x: obj.x, y: GROUND, lane: 'mid', under: obj.id }
    case 'vor': return { x: obj.x, y: FRONT_LANE, lane: 'front' }
    case 'hinter': return { x: obj.x, y: BACK_LANE, lane: 'back' }
    case 'neben':
    case 'rechts neben': return beside(1)
    case 'links neben': return beside(-1)
    case 'zwischen': {
      const other = clue.other ? find(clue.other, objects) : undefined
      if (!other) throw new Error('zwischen needs two objects')
      const d = delta(obj.x, other.x)
      const edgeA = obj.x + Math.sign(d) * obj.w / 2
      const edgeB = other.x - Math.sign(d) * other.w / 2
      return { x: wrap((edgeA + edgeB) / 2), y: GROUND, lane: 'mid' }
    }
  }
}

const ARTICLE: Record<Kase, Record<Gender, string>> = {
  nom: { m: 'der', f: 'die', n: 'das' },
  acc: { m: 'den', f: 'die', n: 'das' },
  dat: { m: 'dem', f: 'der', n: 'dem' },
}

/** "der Ball", "den Tisch", "der Bank" */
export const nounPhrase = (x: { noun: string; gender: Gender }, kase: Kase) => `${ARTICLE[kase][x.gender]} ${x.noun}`

const named = (id: string) => find(id, OBJECTS) ?? THINGS.find(t => t.id === id)

/** "auf das Bett" (where it goes, accusative), "im Schrank" (where it is, dative), "zwischen dem Baum und der Bank" */
export function prepPhrase(clue: Clue, kase: 'acc' | 'dat'): string {
  const obj = named(clue.object)
  if (!obj) throw new Error(`no object ${clue.object}`)
  if (clue.word === 'zwischen') {
    const other = clue.other ? named(clue.other) : undefined
    if (!other) throw new Error('zwischen needs two objects')
    return `zwischen ${nounPhrase(obj, kase)} und ${nounPhrase(other, kase)}`
  }
  if (clue.word === 'in' && obj.gender !== 'f') {
    if (kase === 'dat') return `im ${obj.noun}`
    if (obj.gender === 'n') return `ins ${obj.noun}`
  }
  return `${clue.word} ${nounPhrase(obj, kase)}`
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Where a thing is now, in a whole sentence: "Der Ball ist jetzt neben dem Bett." */
export function describe(thingId: string, place: Place, objects: WorldObject[] = OBJECTS): string {
  const thing = THINGS.find(t => t.id === thingId)
  if (!thing) throw new Error(`no thing ${thingId}`)
  const start = `${capital(nounPhrase(thing, 'nom'))} ist jetzt`
  if (place.on) return `${start} ${prepPhrase({ word: 'auf', object: place.on }, 'dat')}.`
  if (place.inside) return `${start} ${prepPhrase({ word: 'in', object: place.inside }, 'dat')}.`
  if (place.under) return `${start} ${prepPhrase({ word: 'unter', object: place.under }, 'dat')}.`
  const closest = objects.reduce((a, b) => (Math.abs(delta(a.x, place.x)) <= Math.abs(delta(b.x, place.x)) ? a : b))
  for (const word of ['vor', 'hinter', 'neben'] as Word[]) {
    if (holds(place, { word, object: closest.id }, objects)) return `${start} ${prepPhrase({ word, object: closest.id }, 'dat')}.`
  }
  return `${start} auf der Wiese.`
}
