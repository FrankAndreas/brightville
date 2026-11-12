// Following a pen along a letter. Ported from Spielzeugkiste (src/logic/tracing.js).
import type { Glyph, Point } from './letters'

// All distances in letter space (see BOX in letters.ts)
const START_RADIUS = 22 // how close to the start dot the pen must touch down
const TOLERANCE = 16 // how far from the guide still counts as on it
const WINDOW = 12 // guide points the pen may move ahead per sample (≈ 24 units)
const END_SLACK = 3 // guide points short of the end that still finish a stroke
const HAND_FACTOR = 2 // a touch this many times the smallest one seen is a resting hand
const NEAR_LETTER = 25 // a touch further than this from every stroke is beside the letter

export type TraceResult = 'stroke-done' | 'letter-done' | 'too-short'
export type MissReason = 'done' | 'pen-busy' | 'too-big' | 'wrong-end' | 'far-from-start' | 'off-letter'
export type PenDown = { accepted: true } | { accepted: false; reason: MissReason }

export interface Tracer {
  letter: Glyph
  /** The stroke that is next, and how far along it the pen got (guide points) */
  stroke: number
  progress: number
  /** The pointer that is the pen right now */
  pen: number | null
  done: boolean
  /** The smallest contact size seen so far; pass it on to the next letter */
  smallest: number
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function createTracer(letter: Glyph, smallest = Infinity): Tracer {
  return { letter, stroke: 0, progress: 0, pen: null, done: false, smallest }
}

const guide = (tr: Tracer) => tr.letter.strokes[tr.stroke]

/**
 * A finger, pen or hand touches down. Only one pen is followed: the first touch
 * that is small enough and starts near the start of the next stroke.
 *
 * Browsers report contact sizes very differently (Firefox 1 px, the iPad
 * 41.6 px in coarse steps, 0 when unknown), so a hand is told apart from the
 * pen by comparing with the smallest contact seen, not by a fixed size.
 */
export function penDown(tr: Tracer, id: number, p: Point, contactPx: number): PenDown {
  if (contactPx > 0) tr.smallest = Math.min(tr.smallest, contactPx)
  if (tr.done) return { accepted: false, reason: 'done' }
  if (tr.pen !== null) return { accepted: false, reason: 'pen-busy' }
  if (contactPx > HAND_FACTOR * tr.smallest) return { accepted: false, reason: 'too-big' }
  const g = guide(tr)
  if (dist(p, g[0]) > START_RADIUS) return { accepted: false, reason: missReason(tr, p, g) }
  tr.pen = id
  tr.progress = 0
  return { accepted: true }
}

// Why a touch away from the start dot missed: at the stroke's other end,
// elsewhere on the letter, or beside it
function missReason(tr: Tracer, p: Point, g: Point[]): MissReason {
  if (dist(p, g[g.length - 1]) <= START_RADIUS) return 'wrong-end'
  const onLetter = tr.letter.strokes.some(s => s.some(q => dist(p, q) <= NEAR_LETTER))
  return onLetter ? 'far-from-start' : 'off-letter'
}

/**
 * The pen moved. Progress only moves forward, and only by a little at a time,
 * so shortcuts and backwards tracing don't count.
 */
export function penMove(tr: Tracer, id: number, p: Point): TraceResult | null {
  if (id !== tr.pen) return null
  const g = guide(tr)
  const end = Math.min(g.length - 1, tr.progress + WINDOW)
  let best = -1
  let bestDist = TOLERANCE
  for (let i = tr.progress; i <= end; i++) {
    const d = dist(p, g[i])
    if (d <= bestDist) {
      best = i
      bestDist = d
    }
  }
  if (best > tr.progress) tr.progress = best
  if (tr.progress < g.length - 1 - END_SLACK) return null
  return finishStroke(tr)
}

function finishStroke(tr: Tracer): TraceResult {
  tr.pen = null
  if (tr.stroke === tr.letter.strokes.length - 1) {
    tr.done = true
    return 'letter-done'
  }
  tr.stroke++
  tr.progress = 0
  return 'stroke-done'
}

/**
 * The pen lifted. Lifting before the end of the stroke starts that stroke
 * over; a dot (Ä, Ö, Ü) is done with the tap.
 */
export function penUp(tr: Tracer, id: number): TraceResult | null {
  if (id !== tr.pen) return null
  if (guide(tr).length === 1) return finishStroke(tr)
  tr.pen = null
  tr.progress = 0
  return 'too-short'
}
