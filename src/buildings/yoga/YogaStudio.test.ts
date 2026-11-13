import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Body } from '@/core/pose/body'
import { FIXTURES, standing } from '@/core/pose/fixtures'
import type { PoseId } from '@/core/pose/poses'
import { CameraError, closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker } from '@/services/poseTracker'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import YogaStudio from './YogaStudio.vue'

vi.mock('@/services/camera', async importOriginal => ({
  CameraError: (await importOriginal<typeof import('@/services/camera')>()).CameraError,
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
  onCameraLost: vi.fn(),
}))
vi.mock('@/services/poseTracker', () => ({ createPoseTracker: vi.fn() }))
vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const poses: PoseId[] = ['stern', 'frosch', 'riese']
const stream = { id: 'fake-stream' } as unknown as MediaStream

/** What the fake tracker "sees" right now */
let seen: Body | null
const tracker = { detect: vi.fn(() => seen), close: vi.fn() }
let cameraLost: () => void

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)

async function open(): Promise<VueWrapper> {
  const w = mount(YogaStudio, { props: { poses }, attachTo: document.body })
  await run(50)
  return w
}

/** Stands in view until the first pose is asked for. */
async function calibrated(): Promise<VueWrapper> {
  const w = await open()
  seen = standing()
  await run(1200)
  return w
}

async function holdPose(id: PoseId) {
  seen = FIXTURES[id]
  await run(5200)
}

describe('YogaStudio', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    seen = null
    tracker.detect.mockClear()
    tracker.close.mockClear()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
    vi.mocked(closeCamera).mockClear()
    vi.mocked(openCamera).mockReset().mockResolvedValue(stream)
    vi.mocked(createPoseTracker).mockReset().mockResolvedValue(tracker)
    vi.mocked(onCameraLost).mockReset().mockImplementation((_s, cb) => { cameraLost = cb })
    // jsdom has no video playback
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows the no-camera screen when the camera is refused and leaves on Enter with 0 stars', async () => {
    vi.mocked(openCamera).mockRejectedValue(new CameraError('denied'))
    const w = await open()
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    expect(speak).toHaveBeenCalledWith('Ich finde keine Kamera.')
    expect(createPoseTracker).not.toHaveBeenCalled()
    // A second Enter right at the door must not skip the screen before it is seen
    press('Enter')
    await run(50)
    expect(w.emitted('finished')).toBeUndefined()
    await run(1000)
    press('Enter')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('shows the no-camera screen when the tracker cannot start, and switches the camera off', async () => {
    vi.mocked(createPoseTracker).mockRejectedValue(new Error('no wasm'))
    const w = await open()
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    expect(closeCamera).toHaveBeenCalledWith(stream)
    w.unmount()
  })

  it('asks the child to step into view and turns the outline green once the body is visible', async () => {
    const w = await open()
    expect(speak).toHaveBeenCalledWith('Stell dich so hin, dass ich dich ganz sehe!')
    expect(w.find('[data-test="outline"]').attributes('data-visible')).toBe('false')
    seen = standing()
    await run(100)
    expect(w.find('[data-test="outline"]').attributes('data-visible')).toBe('true')
    w.unmount()
  })

  it('shows the teacher in the pose that is asked for', async () => {
    const w = await calibrated()
    expect(speak).toHaveBeenLastCalledWith('Mach einen Stern!')
    expect(w.find('[data-test="teacher"]').attributes('data-pose')).toBe('stern')
    w.unmount()
  })

  it('fills the ring while the pose is held', async () => {
    const w = await calibrated()
    seen = FIXTURES.stern
    await run(2500)
    const progress = Number(w.find('[data-test="ring"]').attributes('data-progress'))
    expect(progress).toBeGreaterThan(0.4)
    expect(progress).toBeLessThan(0.6)
    w.unmount()
  })

  it('finishes with 9 stars after three held poses', async () => {
    const w = await calibrated()
    await holdPose('stern')
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(w.findAll('[data-test="dot"][data-result="held"]')).toHaveLength(1)
    await holdPose('frosch')
    await holdPose('riese')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    expect(w.emitted('finished')).toBeUndefined()
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 9 }]])
    w.unmount()
  })

  it('leaves on Escape mid-pose with the stars earned so far', async () => {
    const w = await calibrated()
    await holdPose('stern')
    seen = FIXTURES.frosch
    await run(1000)
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    w.unmount()
  })

  it('leaves by the button mid-pose with the stars earned so far', async () => {
    const w = await calibrated()
    await holdPose('stern')
    requestLeave()
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    expect(closeCamera).toHaveBeenCalledWith(stream)
    w.unmount()
  })

  it('leaves the no-camera screen on a tap, but not in the first second', async () => {
    vi.mocked(openCamera).mockRejectedValue(new CameraError('denied'))
    const w = await open()
    await w.find('[data-test="no-camera"]').trigger('pointerdown')
    await run(50)
    expect(w.emitted('finished')).toBeUndefined()
    await run(1000)
    await w.find('[data-test="no-camera"]').trigger('pointerdown')
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('stops the camera and closes the tracker when leaving', async () => {
    const w = await calibrated()
    press('Escape')
    await run(50)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledWith(stream)
    expect(tracker.close).toHaveBeenCalledTimes(1)
    const calls = tracker.detect.mock.calls.length
    await run(500)
    expect(tracker.detect.mock.calls.length).toBe(calls)
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
    expect(closeCamera).toHaveBeenCalledTimes(1)
  })

  it('switches the camera off when the screen goes away without leaving', async () => {
    const w = await calibrated()
    w.unmount()
    expect(closeCamera).toHaveBeenCalledWith(stream)
    expect(tracker.close).toHaveBeenCalledTimes(1)
  })

  it('switches to no-camera when the camera is lost and keeps earned stars', async () => {
    const w = await calibrated()
    await holdPose('stern')
    cameraLost()
    await run(50)
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    w.unmount()
  })

  it('switches the camera off when tracking breaks down', async () => {
    const w = await calibrated()
    tracker.detect.mockImplementationOnce(() => { throw new Error('tracker crashed') })
    await run(100)
    expect(w.find('[data-test="no-camera"]').exists()).toBe(true)
    expect(closeCamera).toHaveBeenCalledWith(stream)
    press('Escape')
    await run(50)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('lets the child out with Escape right away on the no-camera screen', async () => {
    vi.mocked(openCamera).mockRejectedValue(new CameraError('denied'))
    const w = await open()
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('still lets the child out when switching the tracker off fails', async () => {
    const w = await calibrated()
    tracker.close.mockImplementationOnce(() => { throw new Error('close failed') })
    press('Escape')
    await run(50)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(closeCamera).toHaveBeenCalledWith(stream)
    w.unmount()
  })

  it('does not count the time before the first picture as holding', async () => {
    const w = await open()
    await run(5000)
    seen = standing()
    await run(40)
    // one 30 ms frame of standing is far from the full second of calibration
    expect(w.find('[data-test="teacher"]').attributes('data-pose')).toBe('none')
    w.unmount()
  })

  it('closes a camera that opens after the child already left', async () => {
    let resolveCamera!: (s: MediaStream) => void
    vi.mocked(openCamera).mockReturnValue(new Promise(resolve => { resolveCamera = resolve }))
    const w = mount(YogaStudio, { props: { poses } })
    w.unmount()
    resolveCamera(stream)
    await run(50)
    expect(closeCamera).toHaveBeenCalledWith(stream)
    expect(createPoseTracker).not.toHaveBeenCalled()
  })

  it('renders no text for the child', async () => {
    const w = await calibrated()
    expect(w.text()).toBe('')
    await holdPose('stern')
    expect(w.text()).toBe('')
    w.unmount()

    vi.mocked(openCamera).mockRejectedValue(new CameraError('missing'))
    const none = await open()
    expect(none.text()).toBe('')
    none.unmount()
  })
})
