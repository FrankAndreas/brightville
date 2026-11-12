<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import type { Body } from '@/core/pose/body'
import type { PoseId } from '@/core/pose/poses'
import { keyboardIntents, type IntentSource } from '@/input/intents'
import { closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker, type PoseTracker } from '@/services/poseTracker'
import { playBeat } from '@/services/sound'
import { speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import HoldRing from './HoldRing.vue'
import YogaTeacher from './YogaTeacher.vue'
import { createYogaFlow, pickPoses, type YogaEvent } from './flow'

const props = defineProps<{
  /** The poses of this visit; picked at random when not given */
  poses?: PoseId[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// Tracking every ~30 ms is plenty for held poses and leaves time for drawing
const MIN_FRAME_MS = 30
// A stalled tab must not count as seconds of holding or of waiting
const MAX_FRAME_MS = 250
const CONFETTI_MS = 3000
// Enter is ignored this long after the no-camera picture appears, so a second
// press at the door doesn't skip it before it is seen. Esc always works.
const NO_CAMERA_GRACE_MS = 1000

const poses = props.poses ?? pickPoses()
const flow = createYogaFlow(poses)
const view = reactive({ ...flow.state })
/** How each finished pose went, in order */
const results = ref<('held' | 'missed')[]>([])
const video = ref<HTMLVideoElement | null>(null)

let stream: MediaStream | null = null
let tracker: PoseTracker | null = null
let intents: IntentSource | null = null
let raf = 0
let lastFrame: number | null = null
let noCameraSince: number | null = null
let doneTimer: ReturnType<typeof setTimeout> | undefined
let closed = false
let lastBody: Body | null = null

function send(event: YogaEvent) {
  const before = flow.state.poseNumber
  const effects = flow.send(event)
  const held = effects.some(e => e.type === 'chime')
  // A pose ended when the next one started or the visit finished
  if (flow.state.poseNumber > before ? before > 0 : flow.state.phase === 'done' && view.phase === 'posing') {
    results.value.push(held ? 'held' : 'missed')
  }
  Object.assign(view, flow.state)
  // Without tracking there is no reason to keep filming
  if (flow.state.phase === 'noCamera' && stream) {
    closeCamera(stream)
    stream = null
  }
  for (const effect of effects) {
    if (effect.type === 'speak') void speak(effect.text)
    else if (effect.type === 'chime') playBeat('chime')
    else if (effect.type === 'confetti') doneTimer = setTimeout(leave, CONFETTI_MS)
  }
}

/** Switches everything off. Safe to call more than once. */
/** Takes back this building's answer to the leave button */
let stopLeaveRequests = () => {}
/** True once the no-camera picture has been up long enough to be seen */
let mayConfirm = false

function shutDown() {
  if (closed) return
  closed = true
  cancelAnimationFrame(raf)
  clearTimeout(doneTimer)
  // Each step on its own: one failing must not keep the camera on or the child inside
  const steps = [
    () => { if (stream) closeCamera(stream) },
    () => tracker?.close(),
    () => intents?.dispose(),
    () => stopSpeaking(),
    () => stopLeaveRequests(),
    () => window.removeEventListener('keydown', logBody),
  ]
  for (const step of steps) {
    try {
      step()
    } catch {
      // nothing more to do for this one
    }
  }
}

function leave() {
  if (closed) return
  shutDown()
  emit('finished', { stars: flow.state.stars })
}

function tick(time: number) {
  if (closed) return
  raf = requestAnimationFrame(tick)

  const keys = intents!.read()
  if (view.phase === 'noCamera') noCameraSince ??= time
  mayConfirm = noCameraSince !== null && time - noCameraSince >= NO_CAMERA_GRACE_MS
  if (keys.leave || (keys.interact && mayConfirm)) {
    leave()
    return
  }
  if (!tracker || !video.value || view.phase === 'noCamera' || view.phase === 'done') return
  // The first picture only starts the clock
  if (lastFrame === null) {
    lastFrame = time
    return
  }
  const dt = time - lastFrame
  if (dt < MIN_FRAME_MS) return
  lastFrame = time
  try {
    lastBody = tracker.detect(video.value, time)
  } catch {
    send({ type: 'cameraFailed' })
    return
  }
  send({ type: 'frame', body: lastBody, dtMs: Math.min(dt, MAX_FRAME_MS) })
}

// Development aid: L prints the tracked body, to turn real poses into test data
function logBody(e: KeyboardEvent) {
  if (e.code === 'KeyL' && lastBody) console.log(JSON.stringify(lastBody))
}

onMounted(async () => {
  intents = keyboardIntents()
  stopLeaveRequests = onLeaveRequest(leave)
  if (import.meta.env.DEV) window.addEventListener('keydown', logBody)
  raf = requestAnimationFrame(tick)
  try {
    const opened = await openCamera()
    // The child may have left while the browser was still asking for permission
    if (closed) {
      closeCamera(opened)
      return
    }
    stream = opened
    onCameraLost(opened, () => { if (!closed) send({ type: 'cameraFailed' }) })
    if (video.value) {
      video.value.srcObject = opened
      void video.value.play()?.catch(() => {})
    }
    const created = await createPoseTracker()
    if (closed) {
      created.close()
      return
    }
    tracker = created
    send({ type: 'cameraReady' })
  } catch {
    if (closed) return
    send({ type: 'cameraFailed' })
  }
})

onBeforeUnmount(shutDown)
</script>

<template>
  <div class="studio">
    <div v-if="view.phase === 'noCamera'" class="no-camera" data-test="no-camera" aria-hidden="true" @pointerdown="mayConfirm && leave()">
      <svg viewBox="0 0 120 100" class="camera-off">
        <rect x="14" y="30" width="92" height="56" rx="12" />
        <rect x="42" y="18" width="36" height="16" rx="5" />
        <circle cx="60" cy="58" r="17" class="lens" />
        <line x1="16" y1="92" x2="104" y2="14" class="strike" />
      </svg>
      <svg viewBox="0 0 120 80" class="key">
        <rect x="4" y="4" width="112" height="66" rx="14" class="cap" />
        <path d="M86 22 v18 H40 M52 28 L38 40 L52 52" class="arrow" />
      </svg>
    </div>

    <template v-else>
      <div class="dots" aria-hidden="true">
        <span
          v-for="(_, i) in poses" :key="i" class="dot" data-test="dot"
          :data-result="results[i] ?? (i + 1 === view.poseNumber ? 'now' : 'todo')"
        >
          <svg v-if="results[i] === 'held'" viewBox="0 0 72 24" class="burst">
            <path v-for="n in 3" :key="n" :transform="`translate(${(n - 1) * 24} 0)`" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
        </span>
      </div>

      <div class="stage">
        <div class="mirror">
          <video ref="video" autoplay muted playsinline />
          <svg class="outline" viewBox="0 0 100 100" data-test="outline" :data-visible="view.bodyVisible" aria-hidden="true">
            <circle cx="50" cy="20" r="9" />
            <path d="M50 29 V62 M50 36 L30 54 M50 36 L70 54 M50 62 L38 92 M50 62 L62 92" />
          </svg>
        </div>

        <div class="lesson">
          <HoldRing class="ring" :progress="view.progress" />
          <YogaTeacher class="figure" :pose="view.pose" />
        </div>
      </div>

      <Confetti v-if="view.phase === 'done'" />
    </template>
  </div>
</template>

<style scoped>
.studio {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #e8defc;
}
.dots { display: flex; justify-content: center; gap: 28px; padding: 22px 0 6px; }
.dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(255 255 255 / 70%);
  display: grid;
  place-items: center;
  transition: all 0.3s ease;
}
.dot[data-result='now'] { background: #a58bf0; transform: scale(1.25); }
.dot[data-result='missed'] { background: rgb(255 255 255 / 35%); }
.dot[data-result='held'] { width: 120px; border-radius: 18px; background: #fff; }
.burst { width: 100px; animation: pop 0.5s ease; }
.burst path { fill: #ffd93d; stroke: #e0a800; stroke-width: 1.2; stroke-linejoin: round; }
@keyframes pop { 0% { transform: scale(0.2); } 70% { transform: scale(1.25); } }

.stage { flex: 1; min-height: 0; display: flex; gap: 3vw; padding: 2vh 4vw 5vh; }
.mirror, .lesson { flex: 1; min-width: 0; position: relative; border-radius: 36px; overflow: hidden; }
.mirror { background: #cdbff5; }
/* Mirrored, so moving left moves the picture left */
video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.outline { position: absolute; inset: 4%; width: 92%; height: 92%; }
.outline circle, .outline path {
  fill: none;
  stroke: rgb(255 255 255 / 70%);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 2 5;
  transition: stroke 0.3s ease;
}
.outline[data-visible='true'] circle, .outline[data-visible='true'] path { stroke: #4bd37b; stroke-dasharray: none; }

.lesson { background: #fff7e6; display: grid; place-items: center; overflow: visible; }
.ring, .figure { position: absolute; height: 92%; aspect-ratio: 1; max-width: 92%; }
.figure { height: 74%; }

.no-camera { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6vh; }
.camera-off { width: min(40vw, 40vh); }
.camera-off rect { fill: #b9a7ee; }
.camera-off .lens { fill: #e8defc; }
.camera-off .strike { stroke: #e5484d; stroke-width: 9; stroke-linecap: round; }
.key { width: 140px; animation: press 1s ease-in-out infinite; }
.cap { fill: #fff; stroke: #6b4a00; stroke-width: 5; }
.arrow { fill: none; stroke: #6b4a00; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
@keyframes press { 50% { transform: translateY(6px); } }
</style>
