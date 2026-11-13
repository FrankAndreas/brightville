<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, BEND, HOP, SQUAT } from '@/core/moves/fixtures'
import type { MoveId } from '@/core/moves/reps'
import { playBeat, playNote } from '@/services/sound'
import { speak } from '@/services/tts'
import { useCameraLoop, type CameraEvent } from '../cameraLoop'
import MoveFigure from '../MoveFigure.vue'
import NoCamera from '../NoCamera.vue'
import type { BuildingResult } from '../types'
import { REPS_PER_ROUND, createJumpFlow, pickMoves } from './flow'

// The Hüpfhalle: three rounds of ten moves in front of the camera. The meter only ever fills.
const props = defineProps<{
  /** The moves of this visit; picked at random when not given */
  moves?: MoveId[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const CONFETTI_MS = 3000
// The figure swaps between the two ends of the move at this pace
const SHOW_MS = 650
// Each rep plays the next note up the scale, so the meter sounds like it climbs
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523, 587, 659]
/** The two ends of each move, as the figure shows them */
const SHOWN: Record<MoveId, [Body, Body]> = {
  hampelmann: [standing(), ARMS_UP],
  huepfen: [standing(), HOP],
  kniebeuge: [standing(), SQUAT],
  strecken: [ARMS_UP, BEND],
}

const moves = props.moves ?? pickMoves()
const flow = createJumpFlow(moves)
const view = reactive({ ...flow.state })
const video = ref<HTMLVideoElement | null>(null)
const showPeak = ref(false)
const shown = computed(() => (view.move ? SHOWN[view.move][showPeak.value ? 1 : 0] : standing()))

let closed = false
let doneTimer: ReturnType<typeof setTimeout> | undefined
let showTimer: ReturnType<typeof setInterval> | undefined

function send(event: CameraEvent) {
  const effects = flow.send(event)
  Object.assign(view, flow.state)
  for (const effect of effects) {
    if (effect.type === 'speak') void speak(effect.text)
    else if (effect.type === 'beat') playNote(SCALE[Math.min(SCALE.length, flow.state.count) - 1])
    else if (effect.type === 'chime') playBeat('chime')
    else if (effect.type === 'confetti') doneTimer = setTimeout(leave, CONFETTI_MS)
  }
}

const camera = useCameraLoop({
  video,
  send,
  idle: () => flow.state.phase === 'noCamera' || flow.state.phase === 'done',
  noCamera: () => flow.state.phase === 'noCamera',
  leave,
})

function leave() {
  if (closed) return
  closed = true
  clearTimeout(doneTimer)
  clearInterval(showTimer)
  camera.close()
  emit('finished', { stars: flow.state.stars })
}

onMounted(() => {
  showTimer = setInterval(() => { showPeak.value = !showPeak.value }, SHOW_MS)
})
onBeforeUnmount(() => {
  clearTimeout(doneTimer)
  clearInterval(showTimer)
})
</script>

<template>
  <div class="arena" data-test="huepfhalle" :data-phase="view.phase">
    <NoCamera v-if="view.phase === 'noCamera'" :ready="camera.mayConfirm.value" @leave="leave" />

    <template v-else>
      <div class="rounds" aria-hidden="true">
        <span
          v-for="(_, i) in moves" :key="i" class="round" data-test="round"
          :data-state="i + 1 < view.round || (i + 1 === view.round && view.count >= REPS_PER_ROUND) ? 'done' : i + 1 === view.round ? 'now' : 'todo'"
        >
          <svg v-if="i + 1 < view.round || (i + 1 === view.round && view.count >= REPS_PER_ROUND)" viewBox="0 0 72 24" class="burst">
            <path v-for="n in 3" :key="n" :transform="`translate(${(n - 1) * 24} 0)`" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
        </span>
      </div>

      <div class="stage">
        <div class="mirror" data-test="mirror" :data-seen="view.seen">
          <video ref="video" autoplay muted playsinline />
          <svg class="outline" viewBox="0 0 100 100" data-test="outline" :data-visible="view.seen" aria-hidden="true">
            <circle cx="50" cy="34" r="12" />
            <path d="M22 72 Q24 54 50 52 Q76 54 78 72" />
          </svg>
          <div v-if="view.lost" class="lost" data-test="lost" aria-hidden="true">👀</div>
        </div>

        <div class="lesson">
          <MoveFigure class="figure" :body="shown" color="#4fb3e8" />
          <div class="meter" data-test="meter" :data-count="view.count" aria-hidden="true">
            <i v-for="n in REPS_PER_ROUND" :key="n" :data-on="n <= view.count" />
          </div>
        </div>
      </div>

      <Confetti v-if="view.phase === 'done'" />
    </template>
  </div>
</template>

<style scoped>
.arena {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #dff3e4;
}
.rounds { display: flex; justify-content: center; gap: 28px; padding: 22px 0 6px; }
.round {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(255 255 255 / 70%);
  display: grid;
  place-items: center;
  transition: all 0.3s ease;
}
.round[data-state='now'] { background: #4fb3e8; transform: scale(1.25); }
.round[data-state='done'] { width: 120px; border-radius: 18px; background: #fff; }
.burst { width: 100px; animation: pop 0.5s ease; }
.burst path { fill: #ffd93d; stroke: #e0a800; stroke-width: 1.2; stroke-linejoin: round; }
@keyframes pop { 0% { transform: scale(0.2); } 70% { transform: scale(1.25); } }

.stage { flex: 1; min-height: 0; display: flex; gap: 3vw; padding: 2vh 4vw 5vh; }
.mirror, .lesson { flex: 1; min-width: 0; position: relative; border-radius: 36px; overflow: hidden; }
.mirror { background: #b9e4c6; }
/* The frame says whether the camera sees her: green while seen, orange while not (not red: nothing is wrong) */
.mirror::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 10px #f5a623;
  pointer-events: none;
  transition: box-shadow 0.3s ease;
}
.mirror[data-seen='true']::after { box-shadow: inset 0 0 0 10px #4bd37b; }
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
.lost {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 22vmin;
  background: rgb(255 255 255 / 45%);
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes blink { 50% { opacity: 0.5; } }

.lesson { background: #fffbe8; display: flex; align-items: center; justify-content: space-evenly; overflow: visible; }
.figure { height: 80%; width: auto; aspect-ratio: 1; max-width: 70%; }
.meter {
  height: 80%;
  width: min(9vw, 80px);
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  padding: 8px;
  border-radius: 24px;
  background: rgb(0 0 0 / 8%);
  box-sizing: border-box;
}
.meter i { flex: 1; border-radius: 10px; background: rgb(255 255 255 / 80%); transition: background 0.2s ease, transform 0.2s ease; }
.meter i[data-on='true'] { background: linear-gradient(90deg, #ffd93d, #ff9a3c); animation: pop 0.35s ease; }
</style>
