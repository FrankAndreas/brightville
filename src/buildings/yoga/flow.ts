import { isBodyVisible, type Body } from '@/core/pose/body'
import { createCalibration } from '@/core/pose/calibration'
import { createHold, type Hold } from '@/core/pose/hold'
import { POSES, matchPose, poseDef, type PoseId } from '@/core/pose/poses'

export const POSES_PER_VISIT = 3
export const STARS_PER_POSE = 3

const SAY_STEP_IN = 'Stell dich so hin, dass ich dich ganz sehe!'
const SAY_NO_CAMERA = 'Ich finde keine Kamera.'
const SAY_DONE = 'Super gemacht!'

/** Three different poses for one visit. */
export function pickPoses(random: () => number = Math.random): PoseId[] {
  const pool = POSES.map(p => p.id)
  const picked: PoseId[] = []
  while (picked.length < POSES_PER_VISIT && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(random() * pool.length))
    picked.push(...pool.splice(i, 1))
  }
  return picked
}

export type YogaPhase = 'starting' | 'noCamera' | 'calibrating' | 'posing' | 'done'

export interface YogaState {
  phase: YogaPhase
  /** The pose being asked for */
  pose: PoseId | null
  /** 1 for the first pose; 0 before the poses start */
  poseNumber: number
  /** The ring, 0…1 */
  progress: number
  bodyVisible: boolean
  /** Stars earned in this visit so far */
  stars: number
}

export type YogaEvent =
  | { type: 'cameraReady' }
  /** Refused, missing, or lost later */
  | { type: 'cameraFailed' }
  | { type: 'frame'; body: Body | null; dtMs: number }

/** Things for the screen to do; the flow itself touches no browser API. */
export type YogaEffect =
  /** `ask`: an instruction, kept for the 🔊 button */
  | { type: 'speak'; text: string; ask?: boolean }
  | { type: 'chime' }
  | { type: 'confetti' }

export interface YogaFlow {
  readonly state: YogaState
  send(event: YogaEvent): YogaEffect[]
}

/** One visit to the studio: camera, step into view, the poses, done. */
export function createYogaFlow(poses: PoseId[]): YogaFlow {
  const state: YogaState = { phase: 'starting', pose: null, poseNumber: 0, progress: 0, bodyVisible: false, stars: 0 }
  const calibration = createCalibration()
  let hold: Hold = createHold()

  function nextPose(): YogaEffect[] {
    const pose = poses[state.poseNumber]
    state.progress = 0
    if (!pose) {
      state.phase = 'done'
      state.pose = null
      return [{ type: 'confetti' }, { type: 'speak', text: SAY_DONE }]
    }
    state.phase = 'posing'
    state.pose = pose
    state.poseNumber += 1
    hold = createHold()
    return [{ type: 'speak', text: poseDef(pose).voice, ask: true }]
  }

  function onFrame(body: Body | null, dtMs: number): YogaEffect[] {
    state.bodyVisible = body !== null && isBodyVisible(body)
    if (state.phase === 'calibrating') {
      return calibration.update(state.bodyVisible, dtMs) ? nextPose() : []
    }
    if (state.phase !== 'posing' || !state.pose) return []
    const { progress, status } = hold.update(body !== null && matchPose(state.pose, body), dtMs)
    state.progress = progress
    if (status === 'done') {
      state.stars += STARS_PER_POSE
      return [{ type: 'chime' }, ...nextPose()]
    }
    // Too hard today: on to the next one, no comment and no Stars
    if (status === 'timeout') return nextPose()
    return []
  }

  return {
    state,
    send(event) {
      if (state.phase === 'done' || state.phase === 'noCamera') return []
      switch (event.type) {
        case 'cameraReady':
          if (state.phase !== 'starting') return []
          state.phase = 'calibrating'
          return [{ type: 'speak', text: SAY_STEP_IN, ask: true }]
        case 'cameraFailed':
          state.phase = 'noCamera'
          state.pose = null
          state.progress = 0
          return [{ type: 'speak', text: SAY_NO_CAMERA }]
        case 'frame':
          return onFrame(event.body, event.dtMs)
      }
    },
  }
}
