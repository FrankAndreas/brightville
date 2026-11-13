import type { Body } from '@/core/pose/body'
import { DANCE_MOVES, danceDef, matchDance, type DanceMove } from '@/core/moves/dance'
import { createSight } from '@/core/moves/sight'
import { BARS_PER_SONG, BEATS_PER_BAR, BEATS_PER_SONG, BEAT_MS, TUNES } from '@/core/moves/tunes'

export const SONGS_PER_VISIT = 2
export const STARS_PER_SONG = 5
/** A move still counts this long after its bar ended: children follow a little late */
export const GRACE_MS = BEAT_MS / 2
/** The rest between two songs */
export const BETWEEN_MS = 2500
const BAR_MS = BEAT_MS * BEATS_PER_BAR
const SONG_MS = BEAT_MS * BEATS_PER_SONG

export const SAY_STEP_IN = 'Stell dich vor die Kamera, so dass ich deinen Kopf und deine Schultern sehe!'
export const SAY_LOST = 'Ich sehe dich nicht. Stell dich vor die Kamera.'
export const SAY_NO_CAMERA = 'Ich finde keine Kamera.'
const SAY_SONG_DONE = 'Super getanzt!'

export interface DanceSong {
  /** Index into TUNES */
  tune: number
  /** One move per bar */
  moves: DanceMove[]
}

/** Two different tunes, each with sixteen moves and never the same move twice in a row. */
export function pickSongs(random: () => number = Math.random): DanceSong[] {
  const tunes = TUNES.map((_, i) => i)
  const pick = <T>(list: T[]) => list[Math.min(list.length - 1, Math.floor(random() * list.length))]
  const songs: DanceSong[] = []
  for (let s = 0; s < SONGS_PER_VISIT; s++) {
    const tune = pick(tunes)
    tunes.splice(tunes.indexOf(tune), 1)
    const moves: DanceMove[] = []
    for (let i = 0; i < BARS_PER_SONG; i++) {
      moves.push(pick(DANCE_MOVES.map(m => m.id).filter(id => id !== moves[i - 1])))
    }
    songs.push({ tune, moves })
  }
  return songs
}

/** Five Stars for a whole song, rounded up, so every move she caught is worth something. */
export function songStars(hits: number): number {
  return Math.ceil((STARS_PER_SONG * hits) / BARS_PER_SONG)
}

export type DancePhase = 'starting' | 'noCamera' | 'settling' | 'countIn' | 'dancing' | 'between' | 'done'

export interface DanceState {
  phase: DancePhase
  /** 1 for the first song; 0 before */
  song: number
  /** The bar being danced, 0…15 */
  bar: number
  /** What the dancer shows */
  move: DanceMove | null
  /** Which moves of this song she caught; only ever turns true */
  hits: boolean[]
  stars: number
  seen: boolean
  lost: boolean
}

export type DanceEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

export type DanceEffect =
  | { type: 'speak'; text: string }
  /** A beat: a pitch to play, or null for a rest; the first beat of a bar gets a drum */
  | { type: 'note'; freq: number | null; downbeat: boolean }
  | { type: 'hit' }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface DanceFlow {
  readonly state: DanceState
  send(event: DanceEvent): DanceEffect[]
  /** The Stars so far, with the moves already caught in a song that hasn't ended: leaving never throws them away */
  earned(): number
}

/**
 * One visit to the Tanzsaal: two songs of sixteen moves. A caught move lights its note, a missed one stays dark.
 * The song only plays on while she is seen, so a lost camera never costs her a move.
 */
export function createDanceFlow(songs: DanceSong[]): DanceFlow {
  const state: DanceState = {
    phase: 'starting', song: 0, bar: 0, move: null, hits: [], stars: 0, seen: false, lost: false,
  }
  const sight = createSight()
  let ms = 0
  let lastBeat = -1
  let named = new Set<DanceMove>()

  const current = () => songs[state.song - 1]

  function name(move: DanceMove): DanceEffect[] {
    if (named.has(move)) return []
    named.add(move)
    return [{ type: 'speak', text: danceDef(move).voice }]
  }

  function startCountIn(): DanceEffect[] {
    state.song += 1
    state.phase = 'countIn'
    state.bar = 0
    state.hits = Array(BARS_PER_SONG).fill(false)
    state.move = current().moves[0]
    named = new Set()
    ms = 0
    lastBeat = -1
    return name(state.move)
  }

  function beats(until: number, last: number, note: (k: number) => DanceEffect): DanceEffect[] {
    const effects: DanceEffect[] = []
    for (let k = lastBeat + 1; k <= Math.min(until, last); k++) effects.push(note(k))
    lastBeat = Math.max(lastBeat, Math.min(until, last))
    return effects
  }

  function finishSong(): DanceEffect[] {
    state.stars += songStars(state.hits.filter(Boolean).length)
    const effects: DanceEffect[] = [{ type: 'chime' }]
    if (state.song < songs.length) {
      state.phase = 'between'
      ms = 0
      return [...effects, { type: 'speak', text: SAY_SONG_DONE }]
    }
    state.phase = 'done'
    return [...effects, { type: 'confetti' }, { type: 'speak', text: SAY_SONG_DONE }]
  }

  function catches(body: Body | null, unit: number): DanceEffect[] {
    if (!body || !state.seen) return []
    const effects: DanceEffect[] = []
    const bar = Math.floor(ms / BAR_MS)
    const tryBar = (i: number) => {
      if (i < 0 || i >= BARS_PER_SONG || state.hits[i]) return
      if (matchDance(current().moves[i], body, unit)) {
        state.hits[i] = true
        effects.push({ type: 'hit' })
      }
    }
    tryBar(bar)
    if (ms - bar * BAR_MS < GRACE_MS) tryBar(bar - 1)
    return effects
  }

  function onFrame(body: Body | null, dtMs: number): DanceEffect[] {
    const dt = Math.max(0, dtMs || 0)
    const s = sight.update(body, dt)
    state.seen = s.seen
    state.lost = s.lost
    const effects: DanceEffect[] = s.sayLost ? [{ type: 'speak', text: SAY_LOST }] : []

    if (state.phase === 'settling') {
      if (!s.ready) return effects
      effects.push(...startCountIn())
    } else if (state.phase === 'between') {
      ms += dt
      if (ms >= BETWEEN_MS) effects.push(...startCountIn())
      return effects
    } else if (s.ready) {
      ms += dt
    } else {
      // Not seen long enough: the music waits for her
      return effects
    }

    if (state.phase === 'countIn') {
      effects.push(...beats(Math.floor(ms / BEAT_MS), BEATS_PER_BAR - 1, () => ({ type: 'note', freq: null, downbeat: true })))
      if (ms < BAR_MS) return effects
      state.phase = 'dancing'
      ms -= BAR_MS
      lastBeat = -1
    }

    // Dancing
    const tune = TUNES[current().tune]
    effects.push(...beats(Math.floor(ms / BEAT_MS), BEATS_PER_SONG - 1, k => ({
      type: 'note', freq: tune[k], downbeat: k % BEATS_PER_BAR === 0,
    })))
    const bar = Math.min(BARS_PER_SONG - 1, Math.floor(ms / BAR_MS))
    if (bar !== state.bar) {
      state.bar = bar
      state.move = current().moves[bar]
      effects.push(...name(state.move))
    }
    effects.push(...catches(body, s.unit))
    if (ms >= SONG_MS + GRACE_MS) effects.push(...finishSong())
    return effects
  }

  return {
    state,
    earned: () => state.stars + (state.phase === 'dancing' ? songStars(state.hits.filter(Boolean).length) : 0),
    send(event) {
      if (state.phase === 'done' || state.phase === 'noCamera') return []
      switch (event.type) {
        case 'cameraReady':
          if (state.phase !== 'starting') return []
          state.phase = 'settling'
          return [{ type: 'speak', text: SAY_STEP_IN }]
        case 'cameraFailed':
          state.phase = 'noCamera'
          return [{ type: 'speak', text: SAY_NO_CAMERA }]
        case 'frame':
          return onFrame(event.body, event.dtMs)
      }
    },
  }
}
