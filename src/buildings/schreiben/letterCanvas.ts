// Drawing a letter to trace on a canvas, in letter space (see BOX in core/writing/letters.ts).
// Ported from Spielzeugkiste (src/services/letterCanvas.js).
import type { Glyph, Point, ViewBox } from '@/core/writing/letters'
import type { Help } from '@/core/writing/session'
import type { Tracer } from '@/core/writing/tracing'

type Ctx = CanvasRenderingContext2D

const INK = '#7B2FBE'
const BAND = 20   // width of the path to trace in

// A dot (Ä, Ö, Ü) is a stroke of a single point: drawn as a filled circle
function dot(ctx: Ctx, p: Point, width: number, colour: string) {
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2)
  ctx.fill()
}

function path(ctx: Ctx, pts: Point[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
}

/** The child's own lines. */
function drawInk(ctx: Ctx, ink: Point[][], width = 7) {
  ctx.lineCap = ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = width
  for (const line of ink) {
    if (line.length > 1) { path(ctx, line); ctx.stroke() }
    else if (line.length === 1) dot(ctx, line[0], width, INK)   // a tapped dot
  }
}

/** The lines of the "Schreibhaus": cap line, middle, baseline and descender line. */
export function drawLines(ctx: Ctx, box: { lines: number[] }, view: ViewBox) {
  const [top, mid, base, desc] = box.lines
  const left = view.x - view.width
  const right = view.x + view.width * 2
  ctx.setLineDash([])
  const lines: [number, string, number][] = [[top, '#b8d0ea', 1], [mid, '#d6e3f2', 1], [base, '#7fa7d4', 1.6], [desc, '#b8d0ea', 1]]
  for (const [y, colour, width] of lines) {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
}

/**
 * The letter with as much help as asked for ('full', 'dots' or 'start'):
 * bands to trace in, the traced part in green, the child's ink, and the
 * start dot of the next stroke.
 */
export function drawLetter(ctx: Ctx, { letter, tracer, help, ink }: { letter: Glyph; tracer: Tracer; help: Help; ink: Point[][] }) {
  ctx.lineCap = ctx.lineJoin = 'round'
  const many = letter.strokes.length > 1
  letter.strokes.forEach(g => {
    if (g.length === 1) {
      dot(ctx, g[0], BAND, help === 'start' ? '#f1ece4' : '#ece3d6')
      return
    }
    path(ctx, g)
    ctx.strokeStyle = help === 'start' ? '#f1ece4' : '#ece3d6'
    ctx.lineWidth = BAND
    ctx.stroke()
    if (help !== 'start') {
      ctx.setLineDash([0.1, 6])
      ctx.strokeStyle = '#b9a58c'
      ctx.lineWidth = 3
      path(ctx, g)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
  // Traced parts on top, so a later band never covers a finished stroke
  letter.strokes.forEach((g, s) => {
    const traced = s < tracer.stroke || tracer.done ? g : s === tracer.stroke ? g.slice(0, tracer.progress + 1) : []
    if (g.length === 1) {
      if (s < tracer.stroke || tracer.done) dot(ctx, g[0], BAND, '#7ED957')
      return
    }
    if (traced.length > 1) {
      path(ctx, traced)
      ctx.strokeStyle = '#7ED957'
      ctx.lineWidth = BAND
      ctx.stroke()
    }
    if (help === 'full' && s >= tracer.stroke && !tracer.done) arrows(ctx, g)
  })

  drawInk(ctx, ink)

  if (tracer.done) return
  const g = letter.strokes[tracer.stroke]
  ctx.fillStyle = '#2ECC71'
  ctx.beginPath()
  ctx.arc(g[0].x, g[0].y, 9, 0, Math.PI * 2)
  ctx.fill()
  if (help !== 'full') arrow(ctx, g, 6)
  if (help === 'full' && many) {
    ctx.fillStyle = 'white'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(tracer.stroke + 1), g[0].x, g[0].y + 0.5)
  }
}

// Small chevrons along the stroke, pointing the way to write. None where the
// stroke runs back over itself (up and down the stem of G and 9): the two
// directions would cover each other.
function arrows(ctx: Ctx, g: Point[]) {
  const retraced = (i: number) => g.some((q, j) => Math.abs(i - j) > 10 && Math.hypot(q.x - g[i].x, q.y - g[i].y) < 5)
  for (let i = 14; i < g.length - 8; i += 18) if (!retraced(i)) arrow(ctx, g, i)
}

function arrow(ctx: Ctx, g: Point[], i: number) {
  const a = g[Math.min(i, g.length - 1)]
  const b = g[Math.min(g.length - 1, i + 2)]
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x))
  ctx.strokeStyle = '#E67E22'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-4, -5)
  ctx.lineTo(3, 0)
  ctx.lineTo(-4, 5)
  ctx.stroke()
  ctx.restore()
}
