<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { STICK_RADIUS, stickVector, type Point } from '@/input/stick'
import type { TouchIntents } from '@/input/touch'

// Walking and jumping for fingers. The stick has no fixed place: it starts
// wherever the finger lands in the left half, so small hands need not aim.
const props = defineProps<{ source: TouchIntents }>()

/** Where the walking finger landed; null while no finger walks */
const origin = ref<Point | null>(null)
const knob = ref({ x: 0, y: 0 })
let finger: number | null = null

function down(e: PointerEvent) {
  const area = e.currentTarget as Element | null
  // A finger whose lifting never arrived (the iPad switched apps mid-drag) must not block the next one
  if (finger !== null && area?.hasPointerCapture && !area.hasPointerCapture(finger)) letGo()
  if (finger !== null) return
  finger = e.pointerId
  origin.value = { x: e.clientX, y: e.clientY }
  knob.value = { x: 0, y: 0 }
  // Keeps the moves coming when the finger slides out of the area
  area?.setPointerCapture?.(e.pointerId)
}

function move(e: PointerEvent) {
  if (e.pointerId !== finger || !origin.value) return
  const v = stickVector(origin.value, { x: e.clientX, y: e.clientY })
  props.source.setStick(v.x, v.z)
  knob.value = { x: v.x * STICK_RADIUS, y: v.z * STICK_RADIUS }
}

function release(e: PointerEvent) {
  if (e.pointerId === finger) letGo()
}

function letGo() {
  finger = null
  origin.value = null
  props.source.setStick(0, 0)
}

const onVisibility = () => { if (document.hidden) letGo() }
onMounted(() => {
  window.addEventListener('blur', letGo)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  window.removeEventListener('blur', letGo)
  document.removeEventListener('visibilitychange', onVisibility)
  letGo()
})
</script>

<template>
  <div class="touch">
    <div
      class="area" data-test="stick-area"
      @pointerdown="down" @pointermove="move" @pointerup="release" @pointercancel="release" @lostpointercapture="release"
    />
    <div v-if="origin" class="stick" data-test="stick" :style="{ left: `${origin.x}px`, top: `${origin.y}px` }" aria-hidden="true">
      <i class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
    </div>
    <svg v-else class="hint" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" class="ring" />
      <circle cx="50" cy="50" r="20" class="dot" />
      <path d="M50 14 l-7 9 h14 z M50 86 l-7 -9 h14 z M14 50 l9 -7 v14 z M86 50 l-9 -7 v14 z" class="tips" />
    </svg>
    <button
      class="turn left" data-test="turn-left" aria-label="Nach links drehen"
      @pointerdown.prevent="source.setTurn(-1)" @pointerup="source.setTurn(0)" @pointercancel="source.setTurn(0)"
      @pointerleave="source.setTurn(0)"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M70 30 A28 28 0 1 0 78 58 M70 14 V32 H52" /></svg>
    </button>
    <button
      class="turn right" data-test="turn-right" aria-label="Nach rechts drehen"
      @pointerdown.prevent="source.setTurn(1)" @pointerup="source.setTurn(0)" @pointercancel="source.setTurn(0)"
      @pointerleave="source.setTurn(0)"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 30 A28 28 0 1 1 22 58 M30 14 V32 H48" /></svg>
    </button>
    <button class="jump" data-test="jump" aria-label="Springen" @pointerdown.prevent="source.press('jump')">
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 78 V26 M28 46 L50 24 L72 46" /></svg>
    </button>
  </div>
</template>

<style scoped>
.touch { position: fixed; inset: 0; z-index: 4; pointer-events: none; }
.area { position: absolute; left: 0; top: 0; width: 50%; height: 100%; pointer-events: auto; touch-action: none; }
.stick {
  position: absolute;
  width: 150px;
  height: 150px;
  margin: -75px 0 0 -75px;
  border-radius: 50%;
  background: rgb(255 255 255 / 35%);
  border: 4px solid rgb(255 255 255 / 80%);
  box-sizing: border-box;
  display: grid;
  place-items: center;
}
.knob { width: 64px; height: 64px; border-radius: 50%; background: #fff; box-shadow: 0 4px 0 rgb(0 0 0 / 15%); }
.hint {
  position: absolute;
  left: calc(28px + env(safe-area-inset-left));
  bottom: calc(28px + env(safe-area-inset-bottom));
  width: 150px;
  opacity: 0.75;
}
.ring { fill: rgb(255 255 255 / 30%); stroke: #fff; stroke-width: 3; }
.dot, .tips { fill: #fff; }
.jump {
  position: absolute;
  right: calc(28px + env(safe-area-inset-right));
  bottom: calc(28px + env(safe-area-inset-bottom));
  width: 130px;
  height: 130px;
  border: 0;
  border-radius: 50%;
  background: #ffd93d;
  box-shadow: 0 8px 0 #e0a800;
  pointer-events: auto;
  touch-action: none;
  cursor: pointer;
}
.jump:active { transform: translateY(6px); box-shadow: 0 2px 0 #e0a800; }
.jump svg { width: 70%; }
.jump path { fill: none; stroke: #6b4a00; stroke-width: 12; stroke-linecap: round; stroke-linejoin: round; }
/* Above the jump button, small enough not to be hit by a jumping thumb */
.turn {
  position: absolute;
  bottom: calc(190px + env(safe-area-inset-bottom));
  width: 78px;
  height: 78px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  touch-action: none;
  cursor: pointer;
}
.turn.left { right: calc(114px + env(safe-area-inset-right)); }
.turn.right { right: calc(24px + env(safe-area-inset-right)); }
.turn:active { transform: translateY(4px); }
.turn svg { width: 64%; }
.turn path { fill: none; stroke: #4d6fa8; stroke-width: 10; stroke-linecap: round; stroke-linejoin: round; }
</style>
