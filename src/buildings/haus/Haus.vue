<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Api } from '@/services/api'
import { instruct, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useSessionStore } from '@/stores/session'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import Kleiderschrank from './Kleiderschrank.vue'
import RoomPicture from './RoomPicture.vue'
import Schrank from './Schrank.vue'
import Stickerheft from './Stickerheft.vue'
import Trophaeen from './Trophaeen.vue'
import Tagebuch from './Tagebuch.vue'

// The child's own house: a book on the table with what she did, day by day, and an album with her stickers.
const props = defineProps<{
  /** The server; the session's when not given */
  api?: Api
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const api = (props.api ?? useSessionStore().api)!
const player = usePlayerStore()
const view = ref<'room' | 'book' | 'album' | 'wardrobe'>('room')
const albumNew = computed(() => player.unseen.length > 0)

let closed = false
let stopLeaveRequests = () => {}

function show(which: 'room' | 'book' | 'album' | 'wardrobe') {
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
  if (e.code === 'Digit3' || e.code === 'Numpad3') show('wardrobe')
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  void instruct('Willkommen zu Hause! Tipp auf das Buch, das Stickerheft oder den Schrank.')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
})
</script>

<template>
  <div class="haus" data-test="haus" :data-view="view">
    <RoomPicture v-if="view === 'room'" :placed="{}" class="room">
      <div class="table-top">
        <button class="thing book" data-test="open-book" aria-label="Tagebuch" @click="show('book')">
          <span class="picture">📖</span>
        </button>
        <button class="thing album" data-test="open-album" aria-label="Stickerheft" :data-new="albumNew" @click="show('album')">
          <span class="picture">⭐</span>
        </button>
      </div>
      <span class="table" aria-hidden="true" />
      <Trophaeen class="trophy-shelf" />
      <button class="thing wardrobe" data-test="open-wardrobe" aria-label="Kleiderschrank" @click="show('wardrobe')">
        <Schrank />
      </button>
    </RoomPicture>

    <template v-else>
      <button class="back" data-test="back" aria-label="Zurück ins Zimmer" @click="show('room')">🏠</button>
      <Tagebuch v-if="view === 'book'" :api="api" />
      <Kleiderschrank v-else-if="view === 'wardrobe'" />
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
/* The house's own things, laid over the room drawing (RoomPicture), in percent of the room */
.table-top { position: absolute; left: 34%; top: 60%; width: 24%; height: 18%; display: flex; justify-content: space-evenly; align-items: flex-end; }
.table { position: absolute; left: 33%; top: 78%; width: 26%; height: 3.4%; border-radius: 1cqh; background: #9c6b3e; box-shadow: 0 0.8cqh 0 #7d5530; }
.trophy-shelf { position: absolute; left: 51%; top: 17%; width: 33%; }
/* Shaped like the drawing and standing on the floor, so the wall above it opens nothing */
.wardrobe { position: absolute; left: 85%; bottom: 4%; width: 13%; aspect-ratio: 120 / 220; padding: 0; }
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
.picture { font-size: min(13cqh, 9cqw); line-height: 1; filter: drop-shadow(0 0.8cqh 0 rgb(0 0 0 / 12%)); }
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
