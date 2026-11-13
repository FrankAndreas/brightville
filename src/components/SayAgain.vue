<script setup lang="ts">
import { instruction, speak } from '@/services/tts'

// Next to the leave button in every building: says the building's instruction of the moment again, for a child who
// missed it (UX review, Nov 2026). Shown only while there is one.
function again() {
  if (instruction.value) void speak(instruction.value)
}
</script>

<template>
  <button
    v-if="instruction" class="again" data-test="say-again" aria-label="Nochmal hören"
    @pointerdown.prevent @click="again"
  >
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M18 40 H34 L54 22 V78 L34 60 H18 Z" class="speaker" />
      <path d="M66 36 Q76 50 66 64 M76 26 Q92 50 76 74" class="waves" />
    </svg>
  </button>
</template>

<style scoped>
.again {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  left: calc(100px + env(safe-area-inset-left));
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
.again:active { transform: translateY(4px); box-shadow: 0 1px 0 rgb(0 0 0 / 12%); }
.again svg { width: 62%; }
.speaker { fill: #6b4a00; stroke: #6b4a00; stroke-width: 4; stroke-linejoin: round; }
.waves { fill: none; stroke: #b9a27a; stroke-width: 8; stroke-linecap: round; }
</style>
