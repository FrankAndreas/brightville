import { beforeEach, describe, expect, it, vi } from 'vitest'

// MediaPipe itself can't run here: a stand-in landmarker that records what was asked of it
const made: { delegate: string; canvas?: HTMLCanvasElement; detect: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = []
let failing: string[] = []
// Lets a test hold back making the landmarker, to start a second visit meanwhile
let gate: Promise<void> = Promise.resolve()
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(async (_fileset: unknown, options: { baseOptions: { delegate: string }; canvas?: HTMLCanvasElement }) => {
      await gate
      const delegate = options.baseOptions.delegate
      if (failing.includes(delegate)) throw new Error(`no ${delegate}`)
      // Like MediaPipe's: a closed landmarker refuses to look
      let closed = false
      const landmarker = {
        delegate,
        canvas: options.canvas,
        detect: vi.fn(() => {
          if (closed) throw new Error('closed')
          return { landmarks: [] }
        }),
        close: vi.fn(() => { closed = true }),
      }
      made.push(landmarker)
      return { detectForVideo: landmarker.detect, close: landmarker.close }
    }),
  },
}))

const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement

// The kept landmarker lives in the module: every test starts with a fresh one
async function load() {
  vi.resetModules()
  return import('./poseTracker')
}

describe('the pose tracker', () => {
  beforeEach(() => {
    made.length = 0
    failing = []
    gate = Promise.resolve()
  })

  it('is made once and kept for the next visit: a new one each visit would leave the old one in memory', async () => {
    const { createPoseTracker } = await load()
    const first = await createPoseTracker()
    first.detect(video, 100)
    first.close()
    const second = await createPoseTracker()
    second.detect(video, 200)
    expect(made).toHaveLength(1)
    expect(made[0].close).not.toHaveBeenCalled()
    expect(made[0].detect).toHaveBeenCalledTimes(2)
  })

  it('two visits starting at once still share one', async () => {
    const { createPoseTracker } = await load()
    await Promise.all([createPoseTracker(), createPoseTracker()])
    expect(made).toHaveLength(1)
  })

  it('uses the processor when the graphics chip refuses', async () => {
    failing = ['GPU']
    const { createPoseTracker } = await load()
    await createPoseTracker()
    expect(made.map(m => m.delegate)).toEqual(['CPU'])
  })

  it('tries again on the next visit when it could not be made', async () => {
    failing = ['GPU', 'CPU']
    const { createPoseTracker } = await load()
    await expect(createPoseTracker()).rejects.toThrow()
    failing = []
    await createPoseTracker()
    expect(made).toHaveLength(1)
  })

  it('a closed visit sees nobody any more', async () => {
    const { createPoseTracker } = await load()
    const visit = await createPoseTracker()
    visit.close()
    expect(visit.detect(video, 100)).toBeNull()
    expect(made[0].detect).not.toHaveBeenCalled()
  })

  it('never gives MediaPipe a time that is not later than the last one, which it refuses', async () => {
    const { createPoseTracker } = await load()
    ;(await createPoseTracker()).detect(video, 500)
    ;(await createPoseTracker()).detect(video, 500)
    ;(await createPoseTracker()).detect(video, 300)
    const times = made[0].detect.mock.calls.map(call => call[1] as number)
    expect(times[1]).toBeGreaterThan(times[0])
    expect(times[2]).toBeGreaterThan(times[1])
  })

  it('a landmarker that broke is closed and made anew on the next visit', async () => {
    const { createPoseTracker } = await load()
    const visit = await createPoseTracker()
    made[0].detect.mockImplementation(() => { throw new Error('graphics lost') })
    expect(() => visit.detect(video, 100)).toThrow()
    expect(made[0].close).toHaveBeenCalled()
    await createPoseTracker()
    expect(made).toHaveLength(2)
  })

  it('two visits waiting when it could not be made both hear it, and the next visit tries again', async () => {
    failing = ['GPU', 'CPU']
    const { createPoseTracker } = await load()
    const results = await Promise.allSettled([createPoseTracker(), createPoseTracker()])
    expect(results.map(r => r.status)).toEqual(['rejected', 'rejected'])
    failing = []
    ;(await createPoseTracker()).detect(video, 100)
    expect(made).toHaveLength(1)
    expect(made[0].detect).toHaveBeenCalledTimes(1)
  })

  it('one that arrives after she left is kept for the next visit', async () => {
    let open!: () => void
    gate = new Promise(resolve => { open = resolve })
    const { createPoseTracker } = await load()
    const late = createPoseTracker()
    open()
    // The building was left meanwhile: it closes what arrives
    ;(await late).close()
    const next = await createPoseTracker()
    next.detect(video, 100)
    expect(made).toHaveLength(1)
    expect(made[0].detect).toHaveBeenCalledTimes(1)
  })

  it('draws on its own canvas, and is made anew when the iPad takes that canvas\'s graphics away', async () => {
    const { createPoseTracker } = await load()
    await createPoseTracker()
    const canvas = made[0].canvas
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
    canvas!.dispatchEvent(new Event('webglcontextlost'))
    await Promise.resolve()
    expect(made[0].close).toHaveBeenCalled()
    await createPoseTracker()
    expect(made).toHaveLength(2)
    expect(made[1].canvas).not.toBe(canvas)
  })

  it('a broken one\'s canvas going dark later leaves the new one alone (closing it may do just that)', async () => {
    const { createPoseTracker } = await load()
    const visit = await createPoseTracker()
    made[0].detect.mockImplementation(() => { throw new Error('graphics lost') })
    expect(() => visit.detect(video, 100)).toThrow()
    ;(await createPoseTracker()).close()
    made[0].canvas!.dispatchEvent(new Event('webglcontextlost'))
    await Promise.resolve()
    await createPoseTracker()
    expect(made).toHaveLength(2)
    expect(made[1].close).not.toHaveBeenCalled()
  })
})
