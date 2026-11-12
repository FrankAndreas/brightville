<script setup lang="ts">
import { requestLeave } from '@/buildings/leave'

// The way out of every building for fingers and the mouse: a door with an arrow.
// Only a short tap counts: a hand resting on the corner while writing must not end the visit.
const TAP_MS = 600
let press: { id: number; at: number } | null = null

function down(e: PointerEvent) {
  press = { id: e.pointerId, at: Date.now() }
}

function up(e: PointerEvent) {
  const started = press
  press = null
  if (started && started.id === e.pointerId && Date.now() - started.at <= TAP_MS) requestLeave()
}
</script>

<template>
  <button class="leave" data-test="leave" aria-label="Hinaus" @pointerdown.prevent="down" @pointerup="up" @pointercancel="press = null">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M46 16 H80 V84 H46" class="frame" />
      <path d="M60 50 H16 M32 34 L16 50 L32 66" class="arrow" />
    </svg>
  </button>
</template>

<style scoped>
.leave {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  left: calc(16px + env(safe-area-inset-left));
  z-index: 20;
  width: 72px;
  height: 72px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 5px 0 rgb(0 0 0 / 12%);
  cursor: pointer;
  touch-action: none;
}
.leave:active { transform: translateY(4px); box-shadow: 0 1px 0 rgb(0 0 0 / 12%); }
.leave svg { width: 62%; }
.frame { fill: none; stroke: #b9a27a; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
.arrow { fill: none; stroke: #6b4a00; stroke-width: 10; stroke-linecap: round; stroke-linejoin: round; }
</style>
