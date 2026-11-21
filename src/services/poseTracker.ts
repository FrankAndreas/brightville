import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { bodyFromLandmarks, type Body } from '@/core/pose/body'

// Served by the app itself (see scripts/fetch-pose-assets.mjs), never from a CDN
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`
const MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/pose_landmarker_lite.task`

export interface PoseTracker {
  /** The body in this video frame, or null when nobody is found. `timeMs` must grow from call to call. */
  detect(video: HTMLVideoElement, timeMs: number): Body | null
  close(): void
}

async function makeLandmarker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const create = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    })
  try {
    return await create('GPU')
  } catch {
    return await create('CPU')
  }
}

// One landmarker for the whole session, shared by Yoga, the Hüpfhalle and the Tanzsaal. Closing one never gave its
// memory back: a new one per visit grew the page by about 50 MB each time, until the town lost its picture.
let kept: Promise<PoseLandmarker> | null = null
// MediaPipe refuses a time that isn't later than the one before, across every visit
let lastTime = -Infinity

/** The kept landmarker, made on the first visit (and again after it could not be made, or broke) */
export async function createPoseTracker(): Promise<PoseTracker> {
  const mine = (kept ??= makeLandmarker())
  let landmarker: PoseLandmarker
  try {
    landmarker = await mine
  } catch (e) {
    if (kept === mine) kept = null
    throw e
  }
  let closed = false

  return {
    detect(video, timeMs) {
      if (closed || video.videoWidth === 0 || video.videoHeight === 0) return null
      lastTime = Math.max(timeMs, lastTime + 1)
      let result
      try {
        result = landmarker.detectForVideo(video, lastTime)
      } catch (e) {
        // Broken (the graphics chip lost it, say): the next visit makes a new one
        if (kept === mine) {
          kept = null
          landmarker.close()
        }
        throw e
      }
      const landmarks = result.landmarks[0]
      return landmarks ? bodyFromLandmarks(landmarks, video.videoWidth / video.videoHeight) : null
    },
    /** The visit is over; the landmarker stays for the next one */
    close: () => {
      closed = true
    },
  }
}
