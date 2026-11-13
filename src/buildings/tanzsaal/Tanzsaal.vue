<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { standing } from '@/core/pose/fixtures'
import { danceDef } from '@/core/moves/dance'
import { BARS_PER_SONG } from '@/core/moves/tunes'
import { playBeat, playNote } from '@/services/sound'
import { speak } from '@/services/tts'
import { useCameraLoop, type CameraEvent } from '../cameraLoop'
import MoveFigure from '../MoveFigure.vue'
import NoCamera from '../NoCamera.vue'
import type { BuildingResult } from '../types'
import { createDanceFlow, pickSongs, type DanceSong } from './flow'

// The Tanzsaal: two little songs; a dancer shows a move each bar and every move she copies lights a note.
const props = defineProps<{
  /** The songs of this visit; picked at random when not given */
  songs?: DanceSong[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const CONFETTI_MS = 3000

const songs = props.songs ?? pickSongs()
const flow = createDanceFlow(songs)
const view = reactive({ ...flow.state, hits: [...flow.state.hits] })
const video = ref<HTMLVideoElement | null>(null)
/** Counts beats, so the dancer bobs to the music */
const beat = ref(0)
const shown = computed(() => (view.move ? danceDef(view.move).body : standing()))

let closed = false
let doneTimer: ReturnType<typeof setTimeout> | undefined

function send(event: CameraEvent) {
  const effects = flow.send(event)
  Object.assign(view, flow.state, { hits: [...flow.state.hits] })
  for (const effect of effects) {
    if (effect.type === 'speak') void speak(effect.text)
    else if (effect.type === 'note') {
      beat.value += 1
      if (effect.downbeat) playBeat('drum')
      if (effect.freq !== null) playNote(effect.freq)
    } else if (effect.type === 'hit') playBeat('sparkle')
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
  camera.close()
  emit('finished', { stars: flow.earned() })
}

onBeforeUnmount(() => clearTimeout(doneTimer))

const songDone = (i: number) => i + 1 < view.song || (i + 1 === view.song && (view.phase === 'between' || view.phase === 'done'))
</script>

<template>
  <div class="hall" data-test="tanzsaal" :data-phase="view.phase">
    <NoCamera v-if="view.phase === 'noCamera'" :ready="camera.mayConfirm.value" @leave="leave" />

    <template v-else>
      <div class="songs" aria-hidden="true">
        <span
          v-for="(_, i) in songs" :key="i" class="song" data-test="song"
          :data-state="songDone(i) ? 'done' : i + 1 === view.song ? 'now' : 'todo'"
        >{{ songDone(i) ? '🎵' : '' }}</span>
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

        <div class="floor">
          <div class="dancer" :data-bob="beat % 2 === 1" data-test="dancer" :data-move="view.move ?? 'none'">
            <MoveFigure :body="shown" color="#e86fb3" />
          </div>
          <div class="notes" aria-hidden="true">
            <i
              v-for="n in BARS_PER_SONG" :key="n" data-test="note" :data-hit="view.hits[n - 1] === true"
              :data-now="view.phase === 'dancing' && view.bar === n - 1"
            >♪</i>
          </div>
        </div>
      </div>

      <Confetti v-if="view.phase === 'done'" />
    </template>
  </div>
</template>

<style scoped>
.hall {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #2d1f4e;
}
.songs { display: flex; justify-content: center; gap: 28px; padding: 22px 0 6px; }
.song {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(255 255 255 / 25%);
  display: grid;
  place-items: center;
  font-size: 26px;
  transition: all 0.3s ease;
}
.song[data-state='now'] { background: #e86fb3; transform: scale(1.25); }
.song[data-state='done'] { width: 72px; border-radius: 18px; background: #ffd93d; }

.stage { flex: 1; min-height: 0; display: flex; gap: 3vw; padding: 2vh 4vw 5vh; }
.mirror, .floor { flex: 1; min-width: 0; position: relative; border-radius: 36px; overflow: hidden; }
.mirror { background: #4a3a78; }
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
  background: rgb(255 255 255 / 35%);
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes blink { 50% { opacity: 0.5; } }

.floor {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 3vh 2vw;
  box-sizing: border-box;
  overflow: visible;
  background: radial-gradient(circle at 50% 30%, #6b4fb0, #3a2a66 70%);
}
.dancer { flex: 1; min-height: 0; aspect-ratio: 1; transition: transform 0.15s ease; }
.dancer[data-bob='true'] { transform: translateY(2.5%) scaleY(0.98); }
.notes { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; width: 100%; }
.notes i {
  font-style: normal;
  text-align: center;
  font-size: min(4vw, 34px);
  line-height: 1.4;
  border-radius: 12px;
  color: rgb(255 255 255 / 25%);
  background: rgb(255 255 255 / 8%);
  transition: all 0.25s ease;
}
.notes i[data-now='true'] { background: rgb(255 255 255 / 25%); }
.notes i[data-hit='true'] { color: #ffd93d; background: rgb(255 217 61 / 25%); animation: pop 0.35s ease; }
@keyframes pop { 0% { transform: scale(0.3); } 70% { transform: scale(1.3); } }
</style>
