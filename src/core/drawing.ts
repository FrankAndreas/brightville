// Tools for free drawing (Malen): what a stroke looks like and how it is drawn.
export const TOOLS = ['brush', 'pencil', 'eraser'] as const
// Shapes are dragged from one corner to the opposite one
export const SHAPES = ['line', 'circle', 'rect', 'triangle', 'star', 'heart'] as const
export const SIZES = ['S', 'M', 'L'] as const

export type Shape = (typeof SHAPES)[number]
export type Tool = (typeof TOOLS)[number] | Shape
export type Size = (typeof SIZES)[number]
export interface Point { x: number; y: number }
export interface Stroke { tool: Tool; size: Size; color: string; points: Point[] }
export const COLORS = [
  '#1f1f1f', '#8d6e63', '#e53935', '#ff7043', '#fdd835', '#7cb342',
  '#2e7d32', '#29b6f6', '#1e66d0', '#8e24aa', '#ff6fc8', '#ffffff',
]
export const PAPER = '#ffffff'

// Line widths per size, in CSS px
const WIDTHS: Record<(typeof TOOLS)[number], Record<Size, number>> = {
  brush:  { S: 6, M: 14, L: 28 },
  pencil: { S: 2, M: 4,  L: 8 },
  eraser: { S: 14, M: 32, L: 64 },
}

export const isShape = (tool: string): tool is Shape => (SHAPES as readonly string[]).includes(tool)

/** Width, colour and opacity of a stroke. The pencil is thin and a little see-through; shapes are drawn like the brush. */
export function strokeStyle(tool: Tool, size: Size, color: string): { width: number; color: string; alpha: number } {
  return {
    width: WIDTHS[isShape(tool) ? 'brush' : tool][size],
    color: tool === 'eraser' ? PAPER : color,
    alpha: tool === 'pencil' ? 0.8 : 1,
  }
}

/** Draws a stroke { tool, size, color, points }: a smooth line, or a dot for a tap. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points
  if (!pts.length) return
  const { width, color, alpha } = strokeStyle(stroke.tool, stroke.size, stroke.color)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (isShape(stroke.tool)) {
    ctx.beginPath()
    shapePath(ctx, stroke.tool, pts[0], pts[pts.length - 1])
    ctx.stroke()
  } else if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Through the midpoints, so the line has no corners
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
  }
  ctx.restore()
}

// The outline of a shape dragged from a to b
function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, a: Point, b: Point) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y)
  const cx = x + w / 2, cy = y + h / 2
  switch (shape) {
    case 'line':
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      break
    case 'circle':
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'rect':
      ctx.rect(x, y, w, h)
      break
    case 'triangle':
      ctx.moveTo(cx, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.4 : 1
        const angle = -Math.PI / 2 + i * Math.PI / 5
        const px = cx + Math.cos(angle) * w / 2 * r
        const py = cy + Math.sin(angle) * h / 2 * r + h * 0.05   // a five-point star sits a little low
        if (i) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      }
      ctx.closePath()
      break
    case 'heart':
      ctx.moveTo(cx, y + h)
      ctx.bezierCurveTo(x - w * 0.05, y + h * 0.55, x, y, cx - w * 0.25, y)
      ctx.bezierCurveTo(cx - w * 0.1, y, cx, y + h * 0.15, cx, y + h * 0.28)
      ctx.bezierCurveTo(cx, y + h * 0.15, cx + w * 0.1, y, cx + w * 0.25, y)
      ctx.bezierCurveTo(x + w, y, x + w * 1.05, y + h * 0.55, cx, y + h)
      break
  }
}
