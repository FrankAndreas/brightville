const EDGE_ZONE = 0.12
const MAX_SCALE = 1.9

/** Hotspot radii are given in pixels of an image rendered this wide. */
export const REF_WIDTH = 800

export interface Hotspot {
  id: number
  key: string
  variant: string
  /** Centre as a fraction of the picture */
  x: number
  y: number
  /** Radius in pixels of a picture REF_WIDTH wide */
  r: number
  label: string
}

export interface Round {
  original: string
  modified: string
  hotspots: Hotspot[]
}

/**
 * Returns a hit-radius multiplier based on proximity to the image edge.
 * Hotspots near an edge are harder to tap accurately, so we enlarge their
 * effective radius up to MAX_SCALE when the hotspot is right at the edge.
 *
 * x and y are fractions of the picture (0–1); the result is 1…MAX_SCALE.
 */
export function edgeScale(x: number, y: number): number {
  const nearest = Math.min(x, 1 - x, y, 1 - y)
  if (nearest >= EDGE_ZONE) return 1
  return 1 + (MAX_SCALE - 1) * (1 - nearest / EDGE_ZONE)
}

/**
 * Tests whether a tap lands within the (edge-scaled) hotspot radius.
 * The radius scales with the rendered image width (see REF_WIDTH).
 * The tap is given as fractions of the picture.
 */
export function hitTest(
  tapX: number, tapY: number, hotspot: { x: number; y: number; r: number }, containerRect: { width: number; height: number },
): boolean {
  const scale = edgeScale(hotspot.x, hotspot.y)
  const screenR = hotspot.r * scale * containerRect.width / REF_WIDTH
  const dx = (tapX - hotspot.x) * containerRect.width
  const dy = (tapY - hotspot.y) * containerRect.height
  return Math.sqrt(dx * dx + dy * dy) <= screenR
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Builds one round from a scene SVG by picking `count` random candidate
 * differences and one variant of each.
 *
 * A candidate is a `<g data-diff="key" data-cx data-cy data-r>` group (hotspot
 * in viewBox units) holding a `<g data-variant="orig">` plus one or more
 * alternatives `<g data-variant="…" data-label="…" display="none">`. The scene
 * file as-is renders as the original image.
 *
 * Passing the previous round's hotspots keeps consecutive rounds apart:
 * differences that weren't in it are picked first, and a difference that has
 * to repeat gets another variant if it has one.
 */
export function buildRound(
  svgText: string, count: number, random: () => number = Math.random, previous: { key: string; variant: string }[] = [],
): Round {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  const [, , vbW, vbH] = (svg.getAttribute('viewBox') ?? '0 0 800 600').split(/[\s,]+/).map(Number)
  const original = new XMLSerializer().serializeToString(doc)

  const lastVariant = new Map(previous.map(h => [h.key, h.variant]))
  const candidates = shuffle([...svg.querySelectorAll('[data-diff]')], random)
  const isFresh = (g: Element) => !lastVariant.has(g.getAttribute('data-diff') ?? '')
  const picked = [...candidates.filter(isFresh), ...candidates.filter(g => !isFresh(g))]
    .slice(0, count)

  const hotspots = picked.map((g, i): Hotspot => {
    const key = g.getAttribute('data-diff') ?? ''
    const all = [...g.children].filter(v => v.getAttribute('data-variant') !== 'orig')
    const others = all.filter(v => v.getAttribute('data-variant') !== lastVariant.get(key))
    const variants = others.length ? others : all
    const variant = variants[Math.floor(random() * variants.length)]
    g.querySelector('[data-variant="orig"]')?.setAttribute('display', 'none')
    variant.removeAttribute('display')
    return {
      id: i + 1,
      key,
      variant: variant.getAttribute('data-variant') ?? '',
      x: Number(g.getAttribute('data-cx')) / vbW,
      y: Number(g.getAttribute('data-cy')) / vbH,
      r: (Number(g.getAttribute('data-r')) * REF_WIDTH) / vbW,
      label: variant.getAttribute('data-label') ?? '',
    }
  })

  return { original, modified: new XMLSerializer().serializeToString(doc), hotspots }
}

// Tapping everywhere is not looking: this many misses within MISS_WINDOW_MS let the pictures rest
const MISSES = 5
const MISS_WINDOW_MS = 10_000
export const REST_MS = 3000

export interface TapRest {
  /** A tap that found nothing; true when it starts a rest */
  miss(now: number): boolean
  resting(now: number): boolean
}

export function createTapRest(): TapRest {
  let misses: number[] = []
  let restUntil = -Infinity
  const resting = (now: number) => now < restUntil
  return {
    resting,
    miss(now) {
      if (resting(now)) return false
      misses = [...misses.filter(t => now - t < MISS_WINDOW_MS), now]
      if (misses.length < MISSES) return false
      misses = []
      restUntil = now + REST_MS
      return true
    },
  }
}
