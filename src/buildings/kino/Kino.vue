<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Film } from '@/services/api'
import { instruct, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import { PLAYER_ORIGIN, endedMessage, playerUrl, thumbnail } from './youtube'

// The Cinema: one of the films the parents chose, bought at the door. Back to the town when it ends.
// The player is sandboxed without popups or top navigation: YouTube's logo and the film's title lead nowhere, so
// the child can't get from here to youtube.com or the YouTube app and its other films (security review, Nov 2026).
const props = defineProps<{
  /** The films to pick from; the parents' list when not given */
  films?: Film[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// After the film ended, before going back to the town
const AFTER_END_MS = 1500

const films = props.films ?? usePlayerStore().films
const playing = ref<Film | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)

let closed = false
let endTimer: ReturnType<typeof setTimeout> | undefined

function pick(film: Film) {
  if (closed || playing.value) return
  stopSpeaking()
  playing.value = film
}

// The player tells its state only to a page that said it listens
function onPlayerLoad() {
  frame.value?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), PLAYER_ORIGIN)
}

function onMessage(e: MessageEvent) {
  if (closed || e.origin !== PLAYER_ORIGIN || !endedMessage(e.data) || endTimer) return
  endTimer = setTimeout(leave, AFTER_END_MS)
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  clearTimeout(endTimer)
  // The film stops with its frame
  playing.value = null
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  // Playing costs Stars at the door; it never earns any
  emit('finished', { stars: 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) leave()
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  if (films.length) void instruct('Such dir einen Film aus.')
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="kino">
    <iframe
      v-if="playing" ref="frame" class="screen" :src="playerUrl(playing.youtube_id, PAGE_ORIGIN)"
      title="Film" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      referrerpolicy="strict-origin-when-cross-origin" allowfullscreen @load="onPlayerLoad"
    />
    <div v-else-if="films.length" class="wall">
      <button
        v-for="f in films" :key="f.id" class="film" data-test="film" :aria-label="f.title || 'Film'"
        @click="pick(f)"
      >
        <img :src="thumbnail(f.youtube_id)" alt="" draggable="false" />
        <span v-if="f.title" class="title">{{ f.title }}</span>
      </button>
    </div>
    <div v-else class="curtain" data-test="no-films">🎭</div>
  </div>
</template>

<script lang="ts">
const PAGE_ORIGIN = window.location.origin
</script>

<style scoped>
.kino {
  position: fixed;
  inset: 0;
  background: #1b1430;
  display: flex;
  align-items: center;
  justify-content: center;
}
.screen {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: black;
}
.wall {
  display: grid;
  /* auto-fit, not auto-fill: no empty columns, so one or two films sit in the middle (UX review) */
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 42vw), 340px));
  justify-content: center;
  align-content: center;
  gap: 18px;
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: 96px 24px 24px;
  box-sizing: border-box;
}
.film {
  position: relative;
  aspect-ratio: 16 / 9;
  padding: 0;
  border: 4px solid #ffd93d;
  border-radius: 18px;
  overflow: hidden;
  background: #2c2347;
  cursor: pointer;
}
.film img { width: 100%; height: 100%; object-fit: cover; display: block; }
.title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  font-size: 1rem;
  text-align: left;
}
.curtain { font-size: 30vmin; }
</style>
