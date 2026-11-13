import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import type { Body } from '@/core/pose/body'
import { keyboardIntents, type IntentSource } from '@/input/intents'
import { closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker, type PoseTracker } from '@/services/poseTracker'
import { stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from './leave'

export type CameraEvent =
  | { type: 'cameraReady' }
  /** Refused, missing, or lost later */
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

export interface CameraLoopOptions {
  video: Ref<HTMLVideoElement | null>
  send(event: CameraEvent): void
  /** Nothing to track any more: no camera, or the visit is over */
  idle(): boolean
  noCamera(): boolean
  /** Esc, the leave button, or Enter on the no-camera screen */
  leave(): void
}

// Tracking every ~30 ms is plenty and leaves time for drawing
const MIN_FRAME_MS = 30
// A stalled tab must not count as seconds of anything
const MAX_FRAME_MS = 250
// Enter is ignored this long after the no-camera picture appears, so a second press at the door doesn't skip it
const NO_CAMERA_GRACE_MS = 1000

/**
 * The camera, the pose tracker and the frame loop of a camera building (the Hüpfhalle and the Tanzsaal;
 * Yoga has its own). Starts on mount, and stops everything on `close` or unmount.
 */
export function useCameraLoop(options: CameraLoopOptions) {
  /** True once the no-camera picture has been up long enough to be seen */
  const mayConfirm = ref(false)
  let stream: MediaStream | null = null
  let tracker: PoseTracker | null = null
  let intents: IntentSource | null = null
  let raf = 0
  let lastFrame: number | null = null
  let noCameraSince: number | null = null
  let closed = false
  let stopLeaveRequests = () => {}

  function stopCamera() {
    if (stream) closeCamera(stream)
    stream = null
  }

  function fail() {
    if (closed) return
    options.send({ type: 'cameraFailed' })
    // Without tracking there is no reason to keep filming
    stopCamera()
  }

  function tick(time: number) {
    if (closed) return
    raf = requestAnimationFrame(tick)
    const keys = intents!.read()
    if (options.noCamera()) noCameraSince ??= time
    mayConfirm.value = noCameraSince !== null && time - noCameraSince >= NO_CAMERA_GRACE_MS
    if (keys.leave || (keys.interact && mayConfirm.value)) {
      options.leave()
      return
    }
    if (!tracker || !options.video.value || options.idle()) return
    // The first picture only starts the clock
    if (lastFrame === null) {
      lastFrame = time
      return
    }
    const dt = time - lastFrame
    if (dt < MIN_FRAME_MS) return
    lastFrame = time
    let body: Body | null
    try {
      body = tracker.detect(options.video.value, time)
    } catch {
      fail()
      return
    }
    options.send({ type: 'frame', body, dtMs: Math.min(dt, MAX_FRAME_MS) })
  }

  /** Switches everything off. Safe to call more than once. */
  function close() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    // Each step on its own: one failing must not keep the camera on or the child inside
    const steps = [stopCamera, () => tracker?.close(), () => intents?.dispose(), stopSpeaking, () => stopLeaveRequests()]
    for (const step of steps) {
      try {
        step()
      } catch {
        // nothing more to do for this one
      }
    }
  }

  onMounted(async () => {
    intents = keyboardIntents()
    stopLeaveRequests = onLeaveRequest(options.leave)
    raf = requestAnimationFrame(tick)
    try {
      const opened = await openCamera()
      // The child may have left while the browser was still asking for permission
      if (closed) {
        closeCamera(opened)
        return
      }
      stream = opened
      onCameraLost(opened, fail)
      const video = options.video.value
      if (video) {
        video.srcObject = opened
        void video.play()?.catch(() => {})
      }
      const created = await createPoseTracker()
      if (closed) {
        created.close()
        return
      }
      tracker = created
      options.send({ type: 'cameraReady' })
    } catch {
      fail()
    }
  })
  onBeforeUnmount(close)

  return { close, mayConfirm }
}
