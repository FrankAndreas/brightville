// The Musterwerkstatt's rows and sorts (Lehrplan 21 MA.1.B patterns, MA.3 sorting; Zugang 5). Everything is said
// aloud; the pieces are drawn shapes, the things to sort pictures with one obvious name. The ladder's steps are the
// design's table (docs/superpowers/specs/2026-11-20-brightville-musterwerkstatt-design.md).

export type Colour = 'rot' | 'blau' | 'gelb' | 'gruen'
export type Shape = 'kreis' | 'dreieck' | 'quadrat'
export interface Piece { colour: Colour; shape: Shape; big: boolean }
/** What changes along a row: one thing, or colour and shape together */
export type Feature = 'colour' | 'shape' | 'size' | 'both'

export interface SortThing {
  id: string
  /** What the voice calls it */
  say: string
  /** A picture, for sorting by kind or size */
  emoji?: string
  /** A drawn piece, for sorting by colour */
  piece?: Piece
  big?: boolean
  basket: 0 | 1
}

export type MusterTask =
  /** `answer`: the index in `choices` of the piece that fills the gap */
  | { type: 'row'; feature: Feature; pieces: Piece[]; gap: number; choices: Piece[]; answer: number }
  /** `baskets`: what the voice calls each basket's things ("Tiere", "roten Sachen", "grossen") */
  | { type: 'sort'; by: 'colour' | 'kind' | 'size'; baskets: [string, string]; examples: [SortThing, SortThing]; things: SortThing[] }

/** Shown before the first task while she is new to a step */
export interface MusterExample { kind: 'row' | 'gap' | 'sort'; task: MusterTask }

export const TASKS_PER_VISIT = 5
/** Two visits' worth of answers at a step: until then each visit starts with an example */
const EXAMPLE_UNTIL = 10
const LAST_STEP = 6

const COLOURS: Colour[] = ['rot', 'blau', 'gelb', 'gruen']
const SHAPES: Shape[] = ['kreis', 'dreieck', 'quadrat']
const COLOUR_WORD: Record<Colour, string> = { rot: 'rot', blau: 'blau', gelb: 'gelb', gruen: 'grün' }
const SHAPE_WORD: Record<Shape, string> = { kreis: 'Kreis', dreieck: 'Dreieck', quadrat: 'Quadrat' }
/** Der Kreis; das Dreieck, das Quadrat */
const MASCULINE: Record<Shape, boolean> = { kreis: true, dreieck: false, quadrat: false }

/** Things to sort by kind, each with one obvious Standard German name */
const KINDS: { name: string; things: [string, string][] }[] = [
  { name: 'Tiere', things: [['Hund', '🐶'], ['Kuh', '🐮'], ['Schwein', '🐷'], ['Frosch', '🐸'], ['Hase', '🐰'], ['Fuchs', '🦊']] },
  { name: 'Früchte', things: [['Apfel', '🍎'], ['Banane', '🍌'], ['Birne', '🍐'], ['Erdbeere', '🍓'], ['Kirschen', '🍒'], ['Trauben', '🍇']] },
  { name: 'Fahrzeuge', things: [['Auto', '🚗'], ['Bus', '🚌'], ['Zug', '🚂'], ['Flugzeug', '✈️'], ['Traktor', '🚜'], ['Rakete', '🚀']] },
]
/** One picture, big and small */
const SIZE_THINGS: [string, string][] = [['Apfel', '🍎'], ['Hund', '🐶'], ['Auto', '🚗'], ['Blume', '🌸'], ['Ball', '⚽'], ['Fisch', '🐟']]

export const samePiece = (a: Piece, b: Piece) => a.colour === b.colour && a.shape === b.shape && a.big === b.big

/** What the voice calls a piece in a row: what changes along it */
export function pieceName(p: Piece, feature: Feature): string {
  if (feature === 'colour') return COLOUR_WORD[p.colour]
  if (feature === 'shape') return SHAPE_WORD[p.shape]
  if (feature === 'size') return p.big ? 'gross' : 'klein'
  return `${COLOUR_WORD[p.colour]}${MASCULINE[p.shape] ? 'er' : 'es'} ${SHAPE_WORD[p.shape]}`
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const between = (lo: number, hi: number, random: () => number) => lo + Math.floor(random() * (hi - lo + 1))

type Unit = 'AB' | 'ABC' | 'AAB' | 'ABB'
/** Which of the unit's distinct values each place takes */
const UNIT_ORDER: Record<Unit, number[]> = { AB: [0, 1], ABC: [0, 1, 2], AAB: [0, 0, 1], ABB: [0, 1, 1] }

/** The distinct pieces a row is made of, varying `feature` only */
function values(feature: Feature, count: number, random: () => number): Piece[] {
  const colour = pick(COLOURS, random)
  const shape = pick(SHAPES, random)
  if (feature === 'colour') return shuffle(COLOURS, random).slice(0, count).map(c => ({ colour: c, shape, big: true }))
  if (feature === 'shape') return shuffle(SHAPES, random).slice(0, count).map(s => ({ colour, shape: s, big: true }))
  if (feature === 'size') return shuffle([true, false], random).slice(0, count).map(big => ({ colour, shape, big }))
  const colours = shuffle(COLOURS, random)
  const shapes = shuffle(SHAPES, random)
  return Array.from({ length: count }, (_, i) => ({ colour: colours[i], shape: shapes[i], big: true }))
}

/** Wrong pieces for the gap: other values of the feature; in a two-thing row one of colour and shape stays right */
function wrongFor(right: Piece, feature: Feature, random: () => number): Piece[] {
  if (feature === 'colour') return shuffle(COLOURS.filter(c => c !== right.colour), random).slice(0, 2).map(c => ({ ...right, colour: c }))
  if (feature === 'shape') return SHAPES.filter(s => s !== right.shape).map(s => ({ ...right, shape: s }))
  if (feature === 'size') return [{ ...right, big: !right.big }]
  return [
    { ...right, shape: pick(SHAPES.filter(s => s !== right.shape), random) },
    { ...right, colour: pick(COLOURS.filter(c => c !== right.colour), random) },
  ]
}

function row(feature: Feature, units: Unit[], inner: boolean, random: () => number): MusterTask {
  const unit = pick(units, random)
  const order = UNIT_ORDER[unit]
  const vals = values(feature, Math.max(...order) + 1, random)
  const length = between(order.length === 2 ? 5 : 6, order.length === 2 ? 7 : 8, random)
  const pieces = Array.from({ length }, (_, i) => vals[order[i % order.length]])
  const gap = inner ? between(1, length - 2, random) : length - 1
  const choices = shuffle([pieces[gap], ...wrongFor(pieces[gap], feature, random)], random)
  return { type: 'row', feature, pieces, gap, choices, answer: choices.findIndex(c => samePiece(c, pieces[gap])) }
}

const PLURAL: Record<Colour, string> = { rot: 'roten', blau: 'blauen', gelb: 'gelben', gruen: 'grünen' }

function sort(by: 'colour' | 'kind' | 'size', random: () => number): MusterTask {
  if (by === 'colour') {
    const [a, b] = shuffle(COLOURS, random)
    const things = [a, b].flatMap((colour, basket) =>
      shuffle(SHAPES, random).map((shape): SortThing => {
        const piece = { colour, shape, big: true }
        return { id: `${colour}-${shape}`, say: pieceName(piece, 'both'), piece, basket: basket as 0 | 1 }
      }))
    return split('colour', [`${PLURAL[a]} Sachen`, `${PLURAL[b]} Sachen`], things)
  }
  if (by === 'kind') {
    const [a, b] = shuffle(KINDS, random)
    const things = [a, b].flatMap((group, basket) =>
      shuffle(group.things, random).slice(0, 3).map(([say, emoji]): SortThing => ({ id: emoji, say, emoji, basket: basket as 0 | 1 })))
    return split('kind', [a.name, b.name], things)
  }
  const [say, emoji] = pick(SIZE_THINGS, random)
  const things = [0, 1].flatMap(basket =>
    [0, 1, 2].map((k): SortThing => ({ id: `${emoji}-${basket}-${k}`, say, emoji, big: basket === 0, basket: basket as 0 | 1 })))
  return split('size', ['grossen', 'kleinen'], things)
}

/** Six things, three per basket in order: the first of each is the basket's example, the rest are hers to sort */
function split(by: 'colour' | 'kind' | 'size', baskets: [string, string], six: SortThing[]): MusterTask {
  const examples: [SortThing, SortThing] = [six[0], six[3]]
  return { type: 'sort', by, baskets, examples, things: [six[1], six[2], six[4], six[5]] }
}

type Maker = (random: () => number) => MusterTask
const colourRow = (units: Unit[], inner = false): Maker => random => row('colour', units, inner, random)
const shapeOrSize: Maker = random =>
  random() < 0.5 ? row('shape', ['AB', 'ABC'], false, random) : row('size', ['AB', 'AAB', 'ABB'], false, random)
/** A gap inside a one-thing row, as at steps 2–3 */
const gapRow: Maker = random =>
  random() < 0.5 ? row('colour', ['ABC', 'AAB', 'ABB'], true, random) : row('shape', ['AB', 'ABC'], true, random)
const bothRow: Maker = random => row('both', ['AB', 'ABC'], false, random)
const colourOrKind: Maker = random => sort(random() < 0.5 ? 'colour' : 'kind', random)
const sizeSort: Maker = random => sort('size', random)
const laterRow: Maker = random => (random() < 0.5 ? colourRow(['ABC', 'AAB', 'ABB'])(random) : shapeOrSize(random))

const STEPS: Maker[][] = [
  Array(5).fill(colourRow(['AB'])),
  Array(5).fill(colourRow(['ABC', 'AAB', 'ABB'])),
  Array(5).fill(shapeOrSize),
  Array(5).fill(colourOrKind),
  [gapRow, bothRow, sizeSort, gapRow, sizeSort],
  [laterRow, colourOrKind, bothRow, gapRow, sizeSort],
]

const keyOf = (t: MusterTask) => JSON.stringify(t.type === 'row' ? [t.pieces, t.gap] : t.things.map(x => x.id).sort())

/** The five tasks of a visit at `step` (1–5, 6 = "fertig"); never the same row or set twice */
export function buildMusterSession(step: number, random: () => number = Math.random): MusterTask[] {
  const makers = STEPS[Math.min(Math.max(step, 1), LAST_STEP) - 1]
  const seen = new Set<string>()
  return makers.map(make => {
    let task = make(random)
    for (let tries = 0; seen.has(keyOf(task)) && tries < 50; tries++) task = make(random)
    seen.add(keyOf(task))
    return task
  })
}

const fixedRow = (feature: Feature, vals: Piece[], order: number[], length: number, gap: number): MusterTask => {
  const pieces = Array.from({ length }, (_, i) => vals[order[i % order.length]])
  const right = pieces[gap]
  const wrong = feature === 'colour'
    ? COLOURS.filter(c => !vals.some(v => v.colour === c)).slice(0, 2).map(c => ({ ...right, colour: c }))
    : SHAPES.filter(s => s !== right.shape).map(s => ({ ...right, shape: s }))
  const choices = [wrong[0], right, wrong[1]]
  return { type: 'row', feature, pieces, gap, choices, answer: 1 }
}
const colourPiece = (colour: Colour): Piece => ({ colour, shape: 'kreis', big: true })

/** The example before the first task: at steps 1–5 while her answers at the step are fewer than two visits' worth */
export function exampleFor(step: number, windowLength: number): MusterExample | null {
  if (step >= LAST_STEP || windowLength >= EXAMPLE_UNTIL) return null
  if (step === 1) return { kind: 'row', task: fixedRow('colour', [colourPiece('rot'), colourPiece('blau')], [0, 1], 5, 4) }
  if (step === 2) {
    return { kind: 'row', task: fixedRow('colour', ['rot', 'gelb', 'blau'].map(c => colourPiece(c as Colour)), [0, 1, 2], 6, 5) }
  }
  if (step === 3) {
    const shapes = (['kreis', 'dreieck'] as Shape[]).map(shape => ({ colour: 'blau' as Colour, shape, big: true }))
    return { kind: 'row', task: fixedRow('shape', shapes, [0, 1], 5, 4) }
  }
  if (step === 4) {
    const animals = KINDS[0].things.slice(0, 3).map(([say, emoji]): SortThing => ({ id: emoji, say, emoji, basket: 0 }))
    const fruit = KINDS[1].things.slice(0, 3).map(([say, emoji]): SortThing => ({ id: emoji, say, emoji, basket: 1 }))
    return { kind: 'sort', task: split('kind', ['Tiere', 'Früchte'], [...animals, ...fruit]) }
  }
  return { kind: 'gap', task: fixedRow('colour', [colourPiece('rot'), colourPiece('blau')], [0, 1], 5, 1) }
}
