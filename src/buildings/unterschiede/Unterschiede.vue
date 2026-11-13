<script lang="ts">
import type { Hotspot } from '@/core/differences'

// The last round per scene, kept while the page is open, so the next visit to that scene picks others
const lastRounds = new Map<string, Hotspot[]>()
const LAST_SCENE_KEY = 'brightville.lastScene'
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { REF_WIDTH, REST_MS, buildRound, createTapRest, edgeScale, hitTest, type Round } from '@/core/differences'
import { playBeat } from '@/services/sound'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import { loadScene, pickScene } from './scenes'

// Spot the differences: two pictures, ten differences, a Star for each one found without the lamp.
const props = defineProps<{
  /** The scene of this visit; at random when not given */
  scene?: string
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const COUNT = 10
// After the last difference is said, before the cheer
const CHEER_AFTER_MS = 800
const CONFETTI_MS = 3000
// How long the lamp's circle stays
const HINT_MS = 2500

const round = ref<Round | null>(null)
const view = reactive({
  found: [] as number[],
  /** Found after the lamp showed them: no Star */
  hinted: [] as number[],
  hintId: null as number | null,
  resting: false,
  done: false,
})
const stars = computed(() => view.found.filter(id => !view.hinted.includes(id)).length)
const pictures = computed(() => round.value
  ? [round.value.original, round.value.modified].map(svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  : [])

let closed = false
const rest = createTapRest()
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

function lastScene(): string | null {
  try {
    return window.localStorage.getItem(LAST_SCENE_KEY)
  } catch {
    return null
  }
}

async function start() {
  const scene = props.scene ?? pickScene(lastScene())
  try {
    window.localStorage.setItem(LAST_SCENE_KEY, scene)
  } catch {
    // No storage: the next scene may be the same one
  }
  const svg = await loadScene(scene)
  if (closed) return
  round.value = buildRound(svg, COUNT, Math.random, lastRounds.get(scene) ?? [])
  lastRounds.set(scene, round.value.hotspots)
  void instruct('Finde die zehn Unterschiede! Tipp sie in einem der Bilder an.')
}

function onTap(e: PointerEvent) {
  const current = round.value
  if (closed || !current || view.done) return
  const now = Date.now()
  if (rest.resting(now)) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  const hit = current.hotspots.find(h => !view.found.includes(h.id) && hitTest(x, y, h, rect))
  if (!hit) {
    if (rest.miss(now)) {
      view.resting = true
      void speak('Schau genau hin!')
      later(() => { view.resting = false }, REST_MS)
    }
    return
  }
  view.found = [...view.found, hit.id]
  if (view.hintId === hit.id) view.hintId = null
  playBeat('chime')
  void speak(hit.label)
  if (view.found.length === current.hotspots.length) {
    view.done = true
    later(() => void speak('Super! Alle Unterschiede gefunden!'), CHEER_AFTER_MS)
    later(leave, CHEER_AFTER_MS + CONFETTI_MS)
  }
}

function showHint() {
  const current = round.value
  if (closed || !current || view.done) return
  const next = current.hotspots.find(h => !view.found.includes(h.id))
  if (!next) return
  view.hintId = next.id
  if (!view.hinted.includes(next.id)) view.hinted = [...view.hinted, next.id]
  void speak('Schau mal dort!')
  later(() => { if (view.hintId === next.id) view.hintId = null }, HINT_MS)
}

function markerStyle(h: Hotspot) {
  const r = h.r * edgeScale(h.x, h.y)
  return { left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${((r * 2) / REF_WIDTH) * 100}%` }
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  const earned = stars.value
  shutDown()
  emit('finished', { stars: earned })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) leave()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  void start()
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="unterschiede" data-test="unterschiede" :data-resting="view.resting">
    <div v-if="round" class="top">
      <div class="dots">
        <span
          v-for="h in round.hotspots" :key="h.id" class="dot" data-test="dot"
          :data-found="view.found.includes(h.id)" :data-star="view.found.includes(h.id) && !view.hinted.includes(h.id)"
          :data-hinted="view.hinted.includes(h.id)" :data-x="h.x" :data-y="h.y" :data-label="h.label"
        >{{ view.found.includes(h.id) ? (view.hinted.includes(h.id) ? '✔️' : '⭐') : '' }}</span>
      </div>
      <button class="lamp" data-test="hint" aria-label="Zeig mir einen" :disabled="view.done" @click="showHint">💡</button>
    </div>
    <div v-if="round" class="row">
      <div
        v-for="(src, i) in pictures" :key="i" class="picture" data-test="picture"
        @pointerdown="onTap"
      >
        <img :src="src" alt="" draggable="false" />
        <template v-for="h in round.hotspots" :key="h.id">
          <span v-if="view.found.includes(h.id)" class="marker" :style="markerStyle(h)" />
          <span
            v-else-if="view.hintId === h.id" class="marker hint" data-test="hint-marker" :style="markerStyle(h)"
          />
        </template>
      </div>
    </div>
    <Confetti v-if="view.done" />
  </div>
</template>

<style scoped>
.unterschiede {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f1fbef;
}
.top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  /* Room on the left for the leave button */
  padding: 14px 16px 6px 90px;
}
.dots { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.dot {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #dde8da;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.dot[data-found='true'] { background: #fff3b0; }
.lamp {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: white;
  font-size: 28px;
  box-shadow: 0 3px 0 #cfe0cb;
}
.lamp:disabled { opacity: 0.4; }
.row {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  container-type: size;
}
.picture {
  position: relative;
  flex: none;
  aspect-ratio: 4 / 3;
  width: min(calc((100cqw - 8px) / 2), calc(100cqh * 4 / 3));
  border-radius: 12px;
  overflow: hidden;
  outline: 3px solid #ffd93d;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
}
@media (orientation: portrait) {
  .row { flex-direction: column; }
  .picture { width: min(100cqw, calc((100cqh - 8px) / 2 * 4 / 3)); }
}
[data-resting='true'] .picture { filter: grayscale(0.6) opacity(0.7); }
.picture img { width: 100%; height: 100%; display: block; pointer-events: none; }
.marker {
  position: absolute;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 4px solid #ff6b6b;
  background: rgba(255, 107, 107, 0.2);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.marker.hint {
  border-color: #ffd93d;
  background: rgba(255, 217, 61, 0.35);
  animation: pulse 0.7s ease-in-out 3;
}
@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.3); }
}
</style>
