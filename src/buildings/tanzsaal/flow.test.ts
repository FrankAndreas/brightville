import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { danceDef, type DanceMove } from '@/core/moves/dance'
import { LOST_AFTER_MS } from '@/core/moves/sight'
import { BARS_PER_SONG, BEATS_PER_BAR, BEATS_PER_SONG, BEAT_MS, TUNES } from '@/core/moves/tunes'
import {
  BETWEEN_MS, GRACE_MS, SAY_LOST, SAY_NO_CAMERA, SAY_STEP_IN, SONGS_PER_VISIT, createDanceFlow, pickSongs,
  songStars, type DanceEffect, type DanceFlow, type DanceSong,
} from './flow'

const STEP = 40
const BAR_MS = BEAT_MS * BEATS_PER_BAR
const COUNT_IN_MS = BAR_MS

function feed(flow: DanceFlow, body: Body | null | ((f: DanceFlow) => Body | null), ms: number): DanceEffect[] {
  const effects: DanceEffect[] = []
  for (let t = 0; t < ms; t += STEP) {
    const b = typeof body === 'function' ? body(flow) : body
    effects.push(...flow.send({ type: 'frame', body: b, dtMs: STEP }))
  }
  return effects
}

/** Does every move as it is shown */
const follow = (f: DanceFlow) => (f.state.move ? danceDef(f.state.move).body : standing())
const said = (effects: DanceEffect[]) => effects.flatMap(e => (e.type === 'speak' ? [e.text] : []))

const order: DanceMove[] = ['armeHoch', 'armeSeite', 'huefte', 'kopf', 'winken', 'klatschen']
const song = (tune: number): DanceSong => ({ tune, moves: Array.from({ length: BARS_PER_SONG }, (_, i) => order[i % 6]) })

function dancing(songs: DanceSong[] = [song(0), song(1)]) {
  const flow = createDanceFlow(songs)
  flow.send({ type: 'cameraReady' })
  feed(flow, standing(), 1100)
  return flow
}

describe('pickSongs', () => {
  it('picks two different tunes with 16 moves, never the same move twice in a row', () => {
    for (const r of [0, 0.5, 0.99]) {
      const songs = pickSongs(() => r)
      expect(songs).toHaveLength(SONGS_PER_VISIT)
      expect(songs[0].tune).not.toBe(songs[1].tune)
      for (const s of songs) {
        expect(s.moves).toHaveLength(BARS_PER_SONG)
        for (let i = 1; i < s.moves.length; i++) expect(s.moves[i]).not.toBe(s.moves[i - 1])
      }
    }
  })
})

describe('songStars', () => {
  it('gives 5 for every move and at least 1 for any', () => {
    expect(songStars(16)).toBe(5)
    expect(songStars(1)).toBe(1)
    expect(songStars(8)).toBe(3)
    expect(songStars(0)).toBe(0)
  })
})

describe('createDanceFlow', () => {
  it('asks her to step in, then counts in with four drum beats before the first move', () => {
    const flow = createDanceFlow([song(0), song(1)])
    expect(said(flow.send({ type: 'cameraReady' }))).toEqual([SAY_STEP_IN])
    const settling = feed(flow, standing(), 1100)
    expect(flow.state.phase).toBe('countIn')
    const countIn = [...settling, ...feed(flow, standing(), COUNT_IN_MS - 200)]
    expect(countIn.filter(e => e.type === 'note')).toEqual(Array(4).fill({ type: 'note', freq: null, downbeat: true }))
    feed(flow, standing(), 300)
    expect(flow.state).toMatchObject({ phase: 'dancing', song: 1, bar: 0, move: 'armeHoch' })
  })

  it('plays the tune one note a beat, with a drum on each bar', () => {
    const flow = createDanceFlow([song(0), song(1)])
    flow.send({ type: 'cameraReady' })
    const notes = feed(flow, standing(), 1100 + COUNT_IN_MS + BAR_MS * 2).filter(e => e.type === 'note')
    const tune = notes.slice(4, 12)
    expect(tune.map(e => e.type === 'note' && e.freq)).toEqual(TUNES[0].slice(0, 8).map(f => f ?? null))
    expect(tune.map(e => e.type === 'note' && e.downbeat)).toEqual([true, false, false, false, true, false, false, false])
  })

  it('lights a note for a move done during its bar, once', () => {
    const flow = dancing()
    feed(flow, standing(), COUNT_IN_MS + 100)
    const effects = feed(flow, danceDef('armeHoch').body, 1000)
    expect(effects.filter(e => e.type === 'hit')).toHaveLength(1)
    expect(flow.state.hits[0]).toBe(true)
  })

  it('takes a move done just after its bar ended', () => {
    const flow = dancing()
    while (flow.state.bar < 1) feed(flow, standing(), STEP)
    // The next bar has begun: armeSeite is shown, but arms up still counts for the bar before
    expect(flow.state.move).toBe('armeSeite')
    feed(flow, danceDef('armeHoch').body, GRACE_MS / 2)
    expect(flow.state.hits[0]).toBe(true)
    // Later than that it doesn't
    const late = dancing()
    while (late.state.bar < 1) feed(late, standing(), STEP)
    feed(late, standing(), GRACE_MS + STEP)
    feed(late, danceDef('armeHoch').body, BAR_MS / 2)
    expect(late.state.hits[0]).toBe(false)
  })

  it('leaves a missed move dark and says nothing about it', () => {
    const flow = dancing()
    const effects = feed(flow, standing(), COUNT_IN_MS + BAR_MS * 3)
    expect(flow.state.hits.slice(0, 2)).toEqual([false, false])
    expect(said(effects).some(t => /nochmal|falsch/i.test(t))).toBe(false)
  })

  it('gives Stars after each song and finishes after two with up to 10', () => {
    const flow = dancing()
    const first = feed(flow, follow, COUNT_IN_MS + BEATS_PER_SONG * BEAT_MS + GRACE_MS + 100)
    expect(flow.state).toMatchObject({ phase: 'between', stars: 5 })
    expect(first.some(e => e.type === 'chime')).toBe(true)
    feed(flow, standing(), BETWEEN_MS)
    expect(flow.state).toMatchObject({ phase: 'countIn', song: 2 })
    const second = feed(flow, follow, COUNT_IN_MS + BEATS_PER_SONG * BEAT_MS + GRACE_MS + 100)
    expect(flow.state).toMatchObject({ phase: 'done', stars: 10 })
    expect(second.some(e => e.type === 'confetti')).toBe(true)
  })

  it('pauses the song while she is lost and goes on where it stopped', () => {
    const flow = dancing()
    feed(flow, standing(), COUNT_IN_MS + BAR_MS + 100)
    expect(flow.state.bar).toBe(1)
    const lost = feed(flow, null, LOST_AFTER_MS + 100)
    expect(said(lost)).toEqual([SAY_LOST])
    const bar = flow.state.bar
    const quiet = feed(flow, null, 5000)
    expect(flow.state.bar).toBe(bar)
    expect(quiet.filter(e => e.type === 'note')).toEqual([])
    expect(flow.state.lost).toBe(true)
    // Back: a second to settle, then the song goes on
    feed(flow, standing(), 1100 + BAR_MS)
    expect(flow.state.bar).toBe(bar + 1)
  })

  it('counts the moves of an unfinished song in what she has earned', () => {
    const flow = dancing()
    expect(flow.earned()).toBe(0)
    feed(flow, follow, COUNT_IN_MS + BAR_MS * 2)
    // Two or three moves caught, depending on where the frames fell: 5 × 3 / 16 rounds up to 1
    expect(flow.state.hits.filter(Boolean).length).toBeGreaterThanOrEqual(2)
    expect(flow.earned()).toBe(1)
    expect(flow.state.stars).toBe(0)
  })

  it('says when there is no camera and does nothing more', () => {
    const flow = createDanceFlow([song(0), song(1)])
    expect(said(flow.send({ type: 'cameraFailed' }))).toEqual([SAY_NO_CAMERA])
    expect(flow.send({ type: 'cameraReady' })).toEqual([])
  })
})
