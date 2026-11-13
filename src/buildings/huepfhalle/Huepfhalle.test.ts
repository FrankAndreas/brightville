import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, SQUAT } from '@/core/moves/fixtures'
import { CameraError, closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker } from '@/services/poseTracker'
import { playBeat, playNote } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Huepfhalle from './Huepfhalle.vue'
import { BREAK_MS, REPS_PER_ROUND } from './flow'

vi.mock('@/services/camera', async importOriginal => ({
  CameraError: (await importOriginal<typeof import('@/services/camera')>()).CameraError,
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
  onCameraLost: vi.fn(),
}))
vi.mock('@/services/poseTracker', () => ({ createPoseTracker: vi.fn() }))
vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), playNote: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

const stream = { id: 'fake-stream' } as unknown as MediaStream
let seen: Body | null
const tracker = { detect: vi.fn(() => seen), close: vi.fn() }
let cameraLost: () => void

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)

async function open(): Promise<VueWrapper> {
  const w = mount(Huepfhalle, { props: { moves: ['hampelmann', 'kniebeuge', 'hampelmann'] }, attachTo: document.body })
  await run(50)
  return w
}

async function settled(): Promise<VueWrapper> {
  const w = await open()
  seen = standing()
  await run(1300)
  return w
}

async function reps(peak: Body, n: number) {
  for (let i = 0; i < n; i++) {
    seen = peak
    await run(200)
    seen = standing()
    await run(200)
  }
}

const meter = (w: VueWrapper) => Number(w.find('[data-test="meter"]').attributes('data-count'))

describe('Huepfhalle', () => {
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
    vi.mocked(onCameraLost).mockReset().mockImplementation((_s, cb) => { cameraLost = cb })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows the no-camera screen when the camera is refused, and leaves on Enter with 0 Stars', async () => {
    vi.mocked(openCamera).mockRejectedValue(new CameraError('denied'))
    const w = await open()
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    expect(speak).toHaveBeenCalledWith('Ich finde keine Kamera.')
    press('Enter')
    await run(50)
    expect(w.emitted('finished')).toBeUndefined()
    await run(1000)
    press('Enter')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
  })

  it('fills the meter one rep at a time with a rising note', async () => {
    const w = await settled()
    expect(speak).toHaveBeenLastCalledWith(expect.stringMatching(/Hampelmann/))
    await reps(ARMS_UP, 3)
    expect(meter(w)).toBe(3)
    expect(vi.mocked(playNote).mock.calls.map(c => c[0])).toEqual([262, 294, 330])
    w.unmount()
  })

  it('pays 9 Stars after three rounds, then switches the camera off', async () => {
    const w = await settled()
    await reps(ARMS_UP, REPS_PER_ROUND)
    expect(w.findAll('[data-test="round"]')[0].attributes('data-state')).toBe('done')
    await run(BREAK_MS + 100)
    await reps(SQUAT, REPS_PER_ROUND)
    await run(BREAK_MS + 100)
    await reps(ARMS_UP, REPS_PER_ROUND)
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 9 }]])
    expect(closeCamera).toHaveBeenCalledWith(stream)
    expect(tracker.close).toHaveBeenCalled()
  })

  it('shows that she is not seen and keeps the meter where it was', async () => {
    const w = await settled()
    await reps(ARMS_UP, 4)
    seen = null
    await run(1700)
    expect(w.find('[data-test="lost"]').exists()).toBe(true)
    expect(meter(w)).toBe(4)
    expect(speak).toHaveBeenLastCalledWith('Ich sehe dich nicht. Stell dich vor die Kamera.')
    seen = standing()
    await run(1300)
    expect(w.find('[data-test="lost"]').exists()).toBe(false)
    await reps(ARMS_UP, 1)
    expect(meter(w)).toBe(5)
    w.unmount()
  })

  it('keeps the Stars of finished rounds when she leaves early', async () => {
    const w = await settled()
    await reps(ARMS_UP, REPS_PER_ROUND)
    await run(BREAK_MS + 100)
    await reps(SQUAT, 4)
    requestLeave()
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    expect(closeCamera).toHaveBeenCalled()
  })

  it('shows the no-camera screen when the camera goes away during the visit', async () => {
    const w = await settled()
    cameraLost()
    await run(50)
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
  })
})
