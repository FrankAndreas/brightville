// The Trommelhaus's tasks on the Rhythmus ladder: keeping a beat, fast and slow, loud and quiet, copying rhythms;
// judging her taps or claps, and finding claps in the microphone's loudness (Lehrplan 21 MU, Zugänge 1 and 2).
// docs/superpowers/specs/2026-11-20-brightville-trommelhaus-design.md

import { WINDOW } from './ladders'
import { shuffle } from './random'
export type Mode = 'tap' | 'clap'
export type Dyn = 'laut' | 'leise'

export type RhythmTask =
  /** The house drums four beats to listen to, then eight to join */
  | { type: 'keep'; bpm: number; speed?: 'schnell' | 'langsam' }
  /** Four beats, loud and quiet in this order */
  | { type: 'dynamics'; order: Dyn[] }
  /** A rhythm to copy: the gaps between its beats in ms */
  | { type: 'copy'; gaps: number[] }

/** One tap or clap: ms from the start of listening; a tap on the big drum; a clap's peak loudness */
export interface Hit { t: number; big?: boolean; peak?: number }

export const LEAD_IN = 4
export const KEEP_BEATS = 8
/** How far from the beat a tap or clap may land */
export const TOLERANCE_MS = 200
/** Of the eight beats to join, at least this many must be met */
const KEEP_NEEDED = 6
/** Each gap of a copied rhythm may be this much longer or shorter */
const GAP_SLACK = 0.35
/** Loud claps at least this much louder than quiet ones */
const LOUDER = 1.5
const DYNAMICS_GAP_MS = 600
const LAST_STEP = 6

/** When the house drums each beat, ms from the start of playing */
export function beatTimes(task: RhythmTask): number[] {
  if (task.type === 'keep') {
    const beat = 60000 / task.bpm
    return Array.from({ length: LEAD_IN + KEEP_BEATS }, (_, i) => i * beat)
  }
  const gaps = task.type === 'copy' ? task.gaps : Array(task.order.length - 1).fill(DYNAMICS_GAP_MS)
  return gaps.reduce((times: number[], g) => [...times, times[times.length - 1] + g], [0])
}

const KEEP_PLAIN = [84, 88, 90, 92, 96]
const KEEP_SPEED: RhythmTask[] = [
  { type: 'keep', bpm: 120, speed: 'schnell' }, { type: 'keep', bpm: 60, speed: 'langsam' },
  { type: 'keep', bpm: 116, speed: 'schnell' }, { type: 'keep', bpm: 66, speed: 'langsam' },
  { type: 'keep', bpm: 124, speed: 'schnell' }, { type: 'keep', bpm: 63, speed: 'langsam' },
]
const ORDERS: Dyn[][] = [
  ['leise', 'leise', 'laut', 'laut'], ['laut', 'laut', 'leise', 'leise'], ['laut', 'leise', 'laut', 'leise'],
  ['leise', 'laut', 'leise', 'laut'], ['laut', 'leise', 'leise', 'laut'], ['leise', 'laut', 'laut', 'leise'],
]
const SHORT: number[][] = [[500, 500], [250, 500], [500, 250], [500, 500, 500], [250, 250, 500], [500, 250, 500]]
const LONG: number[][] = [
  [500, 500, 1000, 500], [250, 250, 1000, 500], [500, 1000, 250, 250], [500, 500, 500, 1000, 500],
  [250, 500, 1000, 250, 250], [500, 250, 250, 1000, 500],
]

/** The five tasks of a visit at `step` (1–5, 6 = "fertig"); never the same twice */
export function buildRhythmSession(step: number, random: () => number = Math.random): RhythmTask[] {
  const s = Math.min(Math.max(step, 1), LAST_STEP)
  const keeps = shuffle(KEEP_PLAIN, random).map((bpm): RhythmTask => ({ type: 'keep', bpm }))
  const speeds = shuffle(KEEP_SPEED, random)
  const dyn = shuffle(ORDERS, random).map((order): RhythmTask => ({ type: 'dynamics', order }))
  const short = shuffle(SHORT, random).map((gaps): RhythmTask => ({ type: 'copy', gaps }))
  const long = shuffle(LONG, random).map((gaps): RhythmTask => ({ type: 'copy', gaps }))
  if (s === 1) return keeps.slice(0, 5)
  if (s === 2) return speeds.slice(0, 5)
  if (s === 3) return dyn.slice(0, 5)
  if (s === 4) return short.slice(0, 5)
  if (s === 5) return long.slice(0, 5)
  return shuffle([keeps[0], speeds[0], dyn[0], short[0], long[0]], random)
}

const TIMES = ['', 'einmal', 'zweimal', 'dreimal', 'viermal']
/** "zweimal leise, dann zweimal laut"; "laut, leise, laut, leise" */
function sayOrder(order: Dyn[]): string {
  const runs: [Dyn, number][] = []
  for (const d of order) {
    const last = runs[runs.length - 1]
    if (last && last[0] === d) last[1] += 1
    else runs.push([d, 1])
  }
  if (runs.every(([, n]) => n === 1)) return order.join(', ')
  return runs.map(([d, n]) => `${TIMES[n]} ${d}`).join(', dann ')
}

/** What the voice asks, in whole sentences */
export function taskText(task: RhythmTask, mode: Mode): string {
  const verb = mode === 'tap' ? 'tipp' : 'klatsch'
  if (task.type === 'keep') {
    // Clapping, the house drums on quietly after the first beats (the microphone mustn't take it for her): she is told
    if (mode === 'clap') {
      if (task.speed) return `Jetzt ganz ${task.speed}! Erst laut, dann leise. Klatsch laut mit!`
      return 'Hör gut zu! Erst spiele ich laut, dann leise. Klatsch laut mit und halte den Takt!'
    }
    if (task.speed) return `Jetzt ganz ${task.speed}! ${verb[0].toUpperCase()}${verb.slice(1)} mit.`
    return `Hör zu und ${verb} mit! Halte den Takt.`
  }
  if (task.type === 'dynamics') {
    const drums = mode === 'tap' ? 'Die große Trommel ist laut, die kleine leise. ' : ''
    return `${drums}Hör zu: ${sayOrder(task.order)}. Jetzt du!`
  }
  return 'Hör zu und mach es nach!'
}

/**
 * Whether she did it. Keeping a beat: `hits` are timed from the first of the eight beats to join; at least six of
 * them met within the tolerance, and not a stream of taps. The others: her beats in order, timed from anywhere.
 */
export function judge(task: RhythmTask, hits: Hit[], mode: Mode): boolean {
  if (task.type === 'keep') {
    const beat = 60000 / task.bpm
    if (hits.length > KEEP_BEATS + 3) return false
    const met = Array.from({ length: KEEP_BEATS }, (_, k) => k * beat)
      .filter(at => hits.some(h => Math.abs(h.t - at) <= TOLERANCE_MS)).length
    return met >= KEEP_NEEDED
  }
  if (task.type === 'copy') {
    if (hits.length !== task.gaps.length + 1) return false
    // In ms, not as a ratio: exactly a third more or less counts both ways
    return task.gaps.every((g, i) => Math.abs(hits[i + 1].t - hits[i].t - g) <= g * GAP_SLACK + 1e-9)
  }
  if (hits.length !== task.order.length) return false
  if (mode === 'tap') return task.order.every((d, i) => hits[i].big === (d === 'laut'))
  const peak = (i: number) => hits[i].peak ?? 0
  const loud = task.order.flatMap((d, i) => (d === 'laut' ? [peak(i)] : []))
  const quiet = task.order.flatMap((d, i) => (d === 'leise' ? [peak(i)] : []))
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.min(...loud) > Math.max(...quiet) && mean(loud) >= LOUDER * mean(quiet)
}

/** A clap: the loudness jumps above the room's own noise; at most one per this many ms */
const CLAP_GAP_MS = 120
const PEAK_WINDOW_MS = 60
const ABOVE_ROOM = 3
const LOUDEST_QUIET = 0.05

/**
 * The claps in a stream of loudness levels (0–1, timed in ms); `floor`: the room's own noise just before; `atLeast`:
 * what isn't louder than this is no clap (the house's own quiet drum, while she claps along)
 */
export function findOnsets(levels: { t: number; level: number }[], floor: number, atLeast = 0): Hit[] {
  const threshold = Math.max(floor * ABOVE_ROOM, LOUDEST_QUIET, atLeast)
  const hits: Hit[] = []
  let last = -Infinity
  levels.forEach((l, i) => {
    const rising = l.level >= threshold && (i === 0 || levels[i - 1].level < threshold)
    if (!rising || l.t - last < CLAP_GAP_MS) return
    last = l.t
    const peak = Math.max(...levels.filter(m => m.t >= l.t && m.t <= l.t + PEAK_WINDOW_MS).map(m => m.level))
    hits.push({ t: l.t, peak })
  })
  return hits
}

/** Whether to show a task once before she answers: at steps 1–5 while she is new to the step */
export const exampleFor = (step: number, windowLength: number) => step < LAST_STEP && windowLength < WINDOW.rhythmus
