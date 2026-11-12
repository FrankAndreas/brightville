<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import { BLANK, COLORS, PAGES, loadPage, type Page } from './pages'

// Coloring pages: a wall of pictures, then one picture whose parts take a colour with a tap.
// A free building: nothing is earned, nothing is kept.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const page = ref<Page | null>(null)
const svg = ref('')
const color = ref(COLORS[0])
/** Fills to take back, newest last */
const history: { el: Element; prev: string | null }[] = []
const canUndo = ref(false)

let closed = false
/** Counts openings, so a page that arrives after the child went back is dropped */
let opening = 0

async function openPage(p: Page) {
  if (closed) return
  const ticket = ++opening
  const source = await loadPage(p.id)
  if (closed || ticket !== opening) return
  history.length = 0
  canUndo.value = false
  svg.value = source
  page.value = p
  void speak(p.say)
}

function fill(e: Event) {
  const target = e.target as Element | null
  if (!target?.hasAttribute('data-region')) return
  history.push({ el: target, prev: target.getAttribute('fill') })
  canUndo.value = true
  target.setAttribute('fill', color.value)
}

function undo() {
  const last = history.pop()
  if (last) last.el.setAttribute('fill', last.prev ?? BLANK)
  canUndo.value = history.length > 0
}

/** From a page back to the wall; from the wall back to the town */
function back() {
  if (closed) return
  if (page.value) {
    opening++
    page.value = null
    svg.value = ''
    return
  }
  shutDown()
  emit('finished', { stars: 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) back()
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(back)
  void speak('Such dir ein Bild aus.')
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="ausmalen">
    <div v-if="!page" class="wall">
      <button
        v-for="p in PAGES" :key="p.id" class="tile" data-test="page" :data-id="p.id"
        :aria-label="p.say" @click="openPage(p)"
      >{{ p.icon }}</button>
    </div>
    <template v-else>
      <!-- Our own line pictures, checked by a test to hold nothing that runs -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="sheet" data-test="sheet" @click="fill" v-html="svg" />
      <div class="palette">
        <button
          v-for="c in COLORS" :key="c" class="swatch" data-test="swatch" :data-selected="c === color"
          :style="{ background: c }" :aria-label="c" @click="color = c"
        />
        <button class="undo" data-test="undo" :disabled="!canUndo" aria-label="Zurück" @click="undo">↩️</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ausmalen {
  position: fixed;
  inset: 0;
  background: #fff9f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.wall {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: min(2.4vw, 18px);
  padding: 90px 16px 16px;
  max-width: 760px;
  width: 100%;
  box-sizing: border-box;
}
.tile {
  aspect-ratio: 1;
  font-size: min(9vw, 64px);
  border: none;
  border-radius: 22px;
  background: white;
  box-shadow: 0 4px 0 #e2d6c2;
  cursor: pointer;
}
.tile:active { transform: translateY(3px); box-shadow: 0 1px 0 #e2d6c2; }
.sheet {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 16px 8px;
  box-sizing: border-box;
}
.sheet :deep(svg) { width: 100%; height: 100%; display: block; }
.sheet :deep([data-region]) { cursor: pointer; }
.palette {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px calc(14px + env(safe-area-inset-bottom));
}
.swatch, .undo {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.swatch[data-selected='true'] { transform: scale(1.2); border-color: #333; }
.undo { background: white; font-size: 26px; }
.undo:disabled { opacity: 0.35; }
</style>
