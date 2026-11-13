import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { danceDef, type DanceMove } from '@/core/moves/dance'
import { BARS_PER_SONG, BEAT_MS, BEATS_PER_SONG } from '@/core/moves/tunes'
import { CameraError, closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker } from '@/services/poseTracker'
import { playBeat, playNote } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Tanzsaal from './Tanzsaal.vue'
import { BETWEEN_MS, type DanceSong } from './flow'

vi.mock('@/services/camera', async importOriginal => ({
  CameraError: (await importOriginal<typeof import('@/services/camera')>()).CameraError,
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
  onCameraLost: vi.fn(),
}))
vi.mock('@/services/poseTracker', () => ({ createPoseTracker: vi.fn() }))
vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), playNote: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const stream = { id: 'fake-stream' } as unknown as MediaStream
/** What the fake tracker sees: a body, or a function of what the dancer shows */
let seen: Body | null | (() => Body | null)
let wrapper: VueWrapper | null = null
const tracker = {
  detect: vi.fn(() => (typeof seen === 'function' ? seen() : seen)),
  close: vi.fn(),
}

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const order: DanceMove[] = ['armeHoch', 'armeSeite', 'huefte', 'kopf']
const songs: DanceSong[] = [0, 1].map(tune => ({ tune, moves: Array.from({ length: BARS_PER_SONG }, (_, i) => order[i % 4]) }))
/** Copies the dancer */
const follow = () => {
  const move = wrapper!.find('[data-test="dancer"]').attributes('data-move') as DanceMove | 'none'
  return move === 'none' ? standing() : danceDef(move).body
}
const SONG_MS = BEAT_MS * (BEATS_PER_SONG + 4) + 600

async function open(): Promise<VueWrapper> {
  wrapper = mount(Tanzsaal, { props: { songs }, attachTo: document.body })
  await run(50)
  return wrapper
}

describe('Tanzsaal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seen = null
    tracker.detect.mockClear()
    tracker.close.mockClear()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
    vi.mocked(playNote).mockClear()
    vi.mocked(closeCamera).mockClear()
    vi.mocked(openCamera).mockReset().mockResolvedValue(stream)
    vi.mocked(createPoseTracker).mockReset().mockResolvedValue(tracker)
    vi.mocked(onCameraLost).mockReset()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('shows the no-camera screen when the camera is refused', async () => {
    vi.mocked(openCamera).mockRejectedValue(new CameraError('denied'))
    const w = await open()
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
  })

  it('plays the tune with a drum on each bar and lights the moves she copies', async () => {
    const w = await open()
    seen = follow
    await run(1200 + 2400 + 2400 * 2)
    expect(playBeat).toHaveBeenCalledWith('drum')
    expect(playNote).toHaveBeenCalled()
    const hits = w.findAll('[data-test="note"]').map(n => n.attributes('data-hit'))
    expect(hits.slice(0, 2)).toEqual(['true', 'true'])
    expect(playBeat).toHaveBeenCalledWith('sparkle')
    w.unmount()
  })

  it('dances two songs and pays 10 Stars for every move caught', async () => {
    const w = await open()
    seen = follow
    await run(1200 + SONG_MS)
    expect(w.findAll('[data-test="song"]')[0].attributes('data-state')).toBe('done')
    await run(BETWEEN_MS + SONG_MS)
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    expect(closeCamera).toHaveBeenCalledWith(stream)
  })

  it('frames the camera picture green while she is seen, orange at once when not', async () => {
    const w = await open()
    const frame = () => w.find('[data-test="mirror"]').attributes('data-seen')
    seen = standing()
    await run(500)
    expect(frame()).toBe('true')
    // At once, long before she counts as lost and the 👀 shows
    seen = null
    await run(200)
    expect(frame()).toBe('false')
    expect(w.find('[data-test="lost"]').exists()).toBe(false)
    w.unmount()
  })

  it('stops the music while she is not seen', async () => {
    const w = await open()
    seen = standing()
    await run(1200 + 2400 + 1000)
    seen = null
    await run(2000)
    expect(w.find('[data-test="lost"]').exists()).toBe(true)
    vi.mocked(playNote).mockClear()
    vi.mocked(playBeat).mockClear()
    await run(5000)
    expect(playNote).not.toHaveBeenCalled()
    expect(playBeat).not.toHaveBeenCalled()
    w.unmount()
  })

  it('pays what was danced so far when she leaves early', async () => {
    const w = await open()
    seen = follow
    await run(1200 + 2400 + 2400 * 4 - 300)
    requestLeave()
    await run(50)
    // Four of sixteen moves caught in an unfinished song: they count, rounded up
    expect(w.emitted('finished')).toEqual([[{ stars: 2 }]])
  })
})
