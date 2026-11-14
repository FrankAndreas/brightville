// The Flatterflug: her wobbly with wings flies through the gaps between columns of clouds. Each flap lifts it a
// little; without flapping it sinks. The meadow below bounces it up again (falling never ends the round), a cloud
// costs a heart, and after it a short moment of grace. Fifteen gates make a round.
//
// Units: the field is 1 high (y from 0 at the top of the sky to 1 at the bottom), x in the same units from the
// left edge; `width` is how wide the field is in them (its aspect ratio). Times in ms, speeds per second.

export type FlightSpeed = 'langsam' | 'mittel' | 'schnell'

/** How fast the clouds come (field heights a second) and how big their gaps are */
export const SPEEDS: Record<FlightSpeed, { pace: number; gap: number }> = {
  langsam: { pace: 0.2, gap: 0.42 },
  mittel: { pace: 0.27, gap: 0.36 },
  schnell: { pace: 0.34, gap: 0.31 },
}

/** The top of the meadow */
export const GROUND = 0.88
/** Where the flyer stays, from the left edge (further left on a narrow field: see flyerX) */
export const FLYER_X = 0.45
/** How big the flyer is, for touching clouds and the meadow */
export const RADIUS = 0.055
/** How wide a column of clouds is */
export const GATE_WIDTH = 0.16
/** From one gate to the next */
export const SPACING = 0.85
export const HEARTS = 3
export const GATES_TO_WIN = 15

const GRAVITY = 1.5
const FLAP = 0.5
const MAX_FALL = 0.75
const BOUNCE = 0.35
/** After a cloud, how long the next one can't cost a heart (longer than flying through one) */
const GRACE_MS = 1500
/** The most a gap moves up or down from the one before */
const STEP = 0.25
/** Room kept between a gap and the top of the sky or the meadow */
const MARGIN = 0.06

export interface Gate {
  /** The column's left edge */
  x: number
  /** The middle of its gap */
  centre: number
  counted: boolean
}

export interface Flight {
  speed: FlightSpeed
  width: number
  random: () => number
  /** Gates to fly through for the round */
  toWin: number
  y: number
  vy: number
  gates: Gate[]
  spawned: number
  passed: number
  hearts: number
  /** While above zero, a cloud costs nothing */
  graceMs: number
  started: boolean
  over: boolean
}

export type FlightEvent = 'passed' | 'half' | 'hit' | 'bounce' | 'won' | 'over'

export function createFlight(opts: { speed: FlightSpeed; width: number; random?: () => number; toWin?: number }): Flight {
  return {
    speed: opts.speed,
    width: opts.width,
    random: opts.random ?? Math.random,
    toWin: opts.toWin ?? GATES_TO_WIN,
    y: 0.45,
    vy: 0,
    gates: [],
    spawned: 0,
    passed: 0,
    hearts: HEARTS,
    graceMs: 0,
    started: false,
    over: false,
  }
}

/** Where the flyer is, from the left edge: on a narrow (upright) field, nearer it, so the next gate is seen in time */
export function flyerX(f: Flight): number {
  return Math.min(FLYER_X, f.width * 0.3)
}

/** The field got wider or narrower (the screen turned). If that moves the flyer, it gets a moment of grace: it can't
 * land in a cloud because of turning the screen. */
export function setWidth(f: Flight, width: number): void {
  const before = flyerX(f)
  f.width = width
  if (flyerX(f) !== before && f.started && !f.over) f.graceMs = Math.max(f.graceMs, GRACE_MS)
}

/** A tap: the wings beat, and the flyer rises a little whatever it did before. The first one starts the round. */
export function flap(f: Flight): void {
  if (f.over) return
  f.started = true
  f.vy = -FLAP
}

/** How far the flyer leans, in radians: up (negative) while rising, down while falling */
export function tilt(f: Flight): number {
  return Math.max(-1, Math.min(1, f.vy / MAX_FALL)) * 0.5
}

function nextCentre(f: Flight): number {
  const { gap } = SPEEDS[f.speed]
  const min = gap / 2 + MARGIN
  const max = GROUND - gap / 2 - MARGIN
  const before = f.gates.at(-1)?.centre
  const centre = before === undefined ? min + (max - min) * f.random() : before + (f.random() * 2 - 1) * STEP
  return Math.max(min, Math.min(max, centre))
}

/** Does the flyer touch this gate's clouds (above or below its gap)? */
function touches(f: Flight, g: Gate): boolean {
  const { gap } = SPEEDS[f.speed]
  const x = flyerX(f)
  const nearestX = Math.max(g.x, Math.min(x, g.x + GATE_WIDTH))
  const dx = x - nearestX
  if (Math.abs(dx) >= RADIUS) return false
  // How far up and down the flyer reaches at this x (a circle)
  const reach = Math.sqrt(RADIUS * RADIUS - dx * dx)
  return f.y - reach < g.centre - gap / 2 || f.y + reach > g.centre + gap / 2
}

/** Moves the flight on by `dtMs`; says what happened */
export function update(f: Flight, dtMs: number): FlightEvent[] {
  if (!f.started || f.over || dtMs <= 0) return []
  const events: FlightEvent[] = []
  const dt = dtMs / 1000
  const { pace } = SPEEDS[f.speed]

  f.vy = Math.min(MAX_FALL, f.vy + GRAVITY * dt)
  f.y += f.vy * dt
  if (f.y - RADIUS < 0) {
    f.y = RADIUS
    f.vy = Math.max(0, f.vy)
  }
  if (f.y + RADIUS > GROUND) {
    f.y = GROUND - RADIUS
    f.vy = -BOUNCE
    events.push('bounce')
  }

  for (const g of f.gates) g.x -= pace * dt
  f.gates = f.gates.filter(g => g.x + GATE_WIDTH > -0.1)
  const last = f.gates.at(-1)
  if (f.spawned < f.toWin && (!last || last.x <= f.width - SPACING)) {
    f.gates.push({ x: last ? Math.max(f.width, last.x + SPACING) : f.width, centre: nextCentre(f), counted: false })
    f.spawned += 1
  }

  f.graceMs = Math.max(0, f.graceMs - dtMs)
  if (f.graceMs === 0 && f.gates.some(g => touches(f, g))) {
    f.hearts -= 1
    f.graceMs = GRACE_MS
    events.push('hit')
    if (f.hearts === 0) {
      f.over = true
      events.push('over')
      return events
    }
  }

  for (const g of f.gates) {
    if (g.counted || g.x + GATE_WIDTH >= flyerX(f) - RADIUS) continue
    g.counted = true
    f.passed += 1
    events.push('passed')
    if (f.passed === Math.ceil(f.toWin / 2)) events.push('half')
    if (f.passed === f.toWin) {
      f.over = true
      events.push('won')
      return events
    }
  }
  return events
}
