// Letters and digits of the Deutschschweizer Basisschrift as strokes of evenly
// spaced points. Ported from Spielzeugkiste (src/logic/letters.js); the paths
// come from its scripts/letters/generate.py, which follows the official font
// and stroke order (its docs/handwriting/basisschrift.md).
import data from './basisschrift.json'

export interface Point {
  x: number
  y: number
}

export interface Glyph {
  name: string
  /** How it is spoken, with its article: "ein Es", "eine Sieben" */
  say: string
  /** In writing order; a stroke of one point is a dot (Ä, Ö, Ü) */
  strokes: Point[][]
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

/** Units: cap height 100; `lines` are the cap line, middle, baseline and descender line. */
export const BOX: { width: number; height: number; lines: number[] } = data.box
const STEP = 2

// Re-spaces a polyline so neighbouring points are STEP apart
function resample(points: Point[]): Point[] {
  const out = [points[0]]
  let prev = points[0]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    let seg = Math.hypot(p.x - prev.x, p.y - prev.y)
    let from = prev
    while (carry + seg >= STEP) {
      const t = (STEP - carry) / seg
      from = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t }
      out.push(from)
      seg = Math.hypot(p.x - from.x, p.y - from.y)
      carry = 0
    }
    carry += seg
    prev = p
  }
  const end = points[points.length - 1]
  const last = out[out.length - 1]
  if (Math.hypot(end.x - last.x, end.y - last.y) > STEP / 2) out.push(end)
  return out
}

const SAY: Record<string, string> = {
  A: 'ein A', B: 'ein Be', C: 'ein Ze', D: 'ein De', E: 'ein E', F: 'ein Ef', G: 'ein Ge',
  H: 'ein Ha', I: 'ein I', J: 'ein Jott', K: 'ein Ka', L: 'ein El', M: 'ein Em', N: 'ein En',
  O: 'ein O', P: 'ein Pe', Q: 'ein Ku', R: 'ein Er', S: 'ein Es', T: 'ein Te', U: 'ein U',
  V: 'ein Fau', W: 'ein We', X: 'ein Ix', Y: 'ein Üpsilon', Z: 'ein Zet',
  Ä: 'ein Ä', Ö: 'ein Ö', Ü: 'ein Ü',
  0: 'eine Null', 1: 'eine Eins', 2: 'eine Zwei', 3: 'eine Drei', 4: 'eine Vier',
  5: 'eine Fünf', 6: 'eine Sechs', 7: 'eine Sieben', 8: 'eine Acht', 9: 'eine Neun',
}

export const GLYPHS: Record<string, Glyph> = Object.fromEntries(
  Object.entries(data.glyphs as Record<string, number[][][]>).map(([name, strokes]) => [name, {
    name,
    say: SAY[name],
    strokes: strokes.map(s => resample(s.map(([x, y]) => ({ x, y })))),
  }]),
)

// A-Z, then Ä, Ö, Ü
export const LETTERS = Object.keys(GLYPHS).filter(c => /[A-ZÄÖÜ]/.test(c)).sort()
export const DIGITS = Object.keys(GLYPHS).filter(c => /\d/.test(c)).sort()

const MARGIN = 10 // around the lines, in units

/**
 * The part of the letter box to show for these glyphs: always the lines of
 * the Schreibhaus down to the bottom band, and above the cap line only as
 * much as dots (Ä, Ö, Ü) need. One box for a whole visit keeps its letters
 * the same size.
 */
export function viewBox(chars: string[]): ViewBox {
  const [top, , , desc] = BOX.lines
  const highest = Math.min(top, ...chars.flatMap(c => GLYPHS[c]?.strokes.flat().map(p => p.y) ?? []))
  const y = highest - MARGIN
  return { x: 0, y, width: BOX.width, height: desc + MARGIN - y }
}

const FIT = 0.95 // of the screen area the view box fills

/** Scale and offset (px) to show the view box centred and as big as fits in w × h px. */
export function fitView(view: ViewBox, w: number, h: number): { scale: number; ox: number; oy: number } {
  const scale = Math.min(w / view.width, h / view.height) * FIT
  return {
    scale,
    ox: (w - view.width * scale) / 2 - view.x * scale,
    oy: (h - view.height * scale) / 2 - view.y * scale,
  }
}
