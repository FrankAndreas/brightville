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

export async function createPoseTracker(): Promise<PoseTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const create = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    })
  let landmarker: PoseLandmarker
  try {
    landmarker = await create('GPU')
  } catch {
    landmarker = await create('CPU')
  }

  return {
    detect(video, timeMs) {
      if (video.videoWidth === 0 || video.videoHeight === 0) return null
      const result = landmarker.detectForVideo(video, timeMs)
      const landmarks = result.landmarks[0]
      return landmarks ? bodyFromLandmarks(landmarks, video.videoWidth / video.videoHeight) : null
    },
    close: () => landmarker.close(),
  }
}
