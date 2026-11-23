<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { createSimonFlow, pickCommands } from '@/core/coach/simon'
import { coachWords, type SimonMove } from '@/core/coach/words'
import type { Lang } from '@/core/vocab/types'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruct, speak } from '@/services/tts'
import { useCameraLoop, type CameraEvent } from '../cameraLoop'
import NoCamera from '../NoCamera.vue'
import type { BuildingResult } from '../types'
import CoachLine from './CoachLine.vue'
import { coachQuiet, coachSay } from './voice'

// The Tanzsaal at Oberstufe: "Simon says" / "Jacques a dit". Fifteen commands written large and spoken in the
// language, a beat in the background, no dancer to copy: understanding the command is the whole game.
const props = defineProps<{
  lang: Lang
  /** The commands of this visit; picked at random when not given */
  commands?: { move: SimonMove; said: boolean }[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const CONFETTI_MS = 3000

const commands = props.commands ?? pickCommands(Math.random)
const flow = createSimonFlow(commands, coachWords(props.lang))
const view = reactive({ ...flow.state, results: [...flow.state.results] })
const video = ref<HTMLVideoElement | null>(null)
const coachText = ref<string | null>(null)
let closed = false
let doneTimer: ReturnType<typeof setTimeout> | undefined

function send(event: CameraEvent) {
  const effects = flow.send(event)
  Object.assign(view, flow.state, { results: [...flow.state.results] })
  for (const effect of effects) {
    if (effect.type === 'speak' && effect.coach) {
      if (effect.ask) {
        coachText.value = effect.text
        // The town's German 🔊 must not repeat the setup line now; the coach has its own
        forgetInstruction()
      }
      void coachSay(props.lang, effect.text)
    } else if (effect.type === 'speak') void (effect.ask ? instruct : speak)(effect.text)
    else if (effect.type === 'beat') playBeat('softDrum')
    else if (effect.type === 'hit') playBeat('sparkle')
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
  if (props.lang) coachQuiet()
  emit('finished', { stars: flow.earned() })
}

onBeforeUnmount(() => clearTimeout(doneTimer))

const pointState = (i: number) => (i < view.results.length ? (view.results[i] ? 'hit' : 'miss') : i === view.index && view.phase === 'command' ? 'now' : 'todo')
</script>

<template>
  <div class="simon" data-test="simon" :data-phase="view.phase">
    <NoCamera v-if="view.phase === 'noCamera'" :ready="camera.mayConfirm.value" @leave="leave" />

    <template v-else>
      <div class="points" aria-hidden="true">
        <span v-for="(_, i) in commands" :key="i" class="point" data-test="point" :data-state="pointState(i)" />
      </div>
      <div class="stage">
        <div class="mirror" :data-seen="view.seen">
          <video ref="video" autoplay muted playsinline />
          <div v-if="view.lost" class="lost" aria-hidden="true">👀</div>
        </div>
        <CoachLine
          v-if="coachText && view.phase !== 'done'" class="coach" :lang="lang" :text="coachText"
          :first="view.index === 0"
        />
      </div>
      <Confetti v-if="view.phase === 'done'" />
    </template>
  </div>
</template>

<style scoped>
.simon { position: absolute; inset: 0; display: flex; flex-direction: column; background: #2b2450; }
.points { display: flex; justify-content: center; gap: 10px; padding: 22px 0 8px; }
.point { width: 18px; height: 18px; border-radius: 50%; background: rgb(255 255 255 / 30%); transition: all 0.3s ease; }
.point[data-state='now'] { background: #ffd93d; transform: scale(1.3); }
.point[data-state='hit'] { background: #4bd37b; }
.point[data-state='miss'] { background: #e5484d; }
.stage { flex: 1; min-height: 0; position: relative; padding: 2vh 104px 5vh; }
.mirror { position: relative; height: 100%; border-radius: 36px; overflow: hidden; background: #3d3470; }
/* Mirrored, so moving left moves the picture left */
video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.lost { position: absolute; inset: 0; display: grid; place-items: center; font-size: 80px; }
.coach { position: absolute; left: 140px; right: 140px; top: 4vh; }
</style>
