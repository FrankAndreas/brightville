<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Api } from '@/services/api'
import { speak, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useSessionStore } from '@/stores/session'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import Stickerheft from './Stickerheft.vue'
import Tagebuch from './Tagebuch.vue'

// The child's own house: a book on the table with what she did, day by day, and an album with her stickers.
const props = defineProps<{
  /** The server; the session's when not given */
  api?: Api
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const api = (props.api ?? useSessionStore().api)!
const player = usePlayerStore()
const view = ref<'room' | 'book' | 'album'>('room')
const albumNew = computed(() => player.unseen.length > 0)

let closed = false
let stopLeaveRequests = () => {}

function show(which: 'room' | 'book' | 'album') {
  stopSpeaking()
  view.value = which
}

function leave() {
  if (closed) return
  closed = true
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
  emit('finished', { stars: 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.code === 'Escape') return leave()
  if (view.value !== 'room') return
  if (e.code === 'Digit1' || e.code === 'Numpad1') show('book')
  if (e.code === 'Digit2' || e.code === 'Numpad2') show('album')
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  void speak('Willkommen zu Hause!')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
})
</script>

<template>
  <div class="haus" data-test="haus" :data-view="view">
    <div v-if="view === 'room'" class="room">
      <div class="window" aria-hidden="true">☀️</div>
      <button class="thing book" data-test="open-book" aria-label="Tagebuch" @click="show('book')">
        <span class="picture">📖</span>
        <span class="table" />
      </button>
      <button class="thing album" data-test="open-album" aria-label="Stickerheft" :data-new="albumNew" @click="show('album')">
        <span class="picture">⭐</span>
        <span class="shelf" />
      </button>
    </div>

    <template v-else>
      <button class="back" data-test="back" aria-label="Zurück ins Zimmer" @click="show('room')">🏠</button>
      <Tagebuch v-if="view === 'book'" :api="api" />
      <Stickerheft v-else />
    </template>
  </div>
</template>

<style scoped>
.haus {
  position: absolute;
  inset: 0;
  background: linear-gradient(#fbe8d3 0 72%, #d9a877 72%);
  overflow: hidden;
}
.room { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: space-evenly; padding-bottom: 10vh; }
.window {
  position: absolute;
  top: 10vh;
  left: 50%;
  translate: -50% 0;
  width: min(26vw, 220px);
  aspect-ratio: 1.3;
  display: grid;
  place-items: center;
  font-size: min(9vw, 80px);
  border: 10px solid #fff;
  border-radius: 16px;
  background: #bfe7ff;
}
.thing {
  border: 0;
  background: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.2s ease;
}
.thing:active { transform: scale(0.95); }
.picture { font-size: min(18vw, 26vh); line-height: 1; filter: drop-shadow(0 8px 0 rgb(0 0 0 / 12%)); }
.table, .shelf { display: block; width: min(30vw, 260px); height: 22px; border-radius: 10px; background: #9c6b3e; }
.shelf { background: #b07d4c; }
.album[data-new='true'] .picture { animation: glow 1.2s ease-in-out infinite; }
@keyframes glow {
  50% { transform: scale(1.12) rotate(-6deg); filter: drop-shadow(0 0 24px #ffd93d); }
}
.back {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 0;
  background: #fff;
  font-size: 2.2rem;
  box-shadow: 0 6px 0 #e3c9a8;
  cursor: pointer;
}
</style>
