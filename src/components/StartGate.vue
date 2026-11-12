<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

// Browsers allow sound and voice only after a press, so the game waits for one
const emit = defineEmits<{ start: [] }>()

const start = () => emit('start')

onMounted(() => window.addEventListener('keydown', start))
onBeforeUnmount(() => window.removeEventListener('keydown', start))
</script>

<template>
  <div class="gate" data-test="start-gate" role="button" aria-label="Spielen" @pointerdown="start">
    <svg class="play" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" />
      <path d="M40 28 L74 50 L40 72 Z" />
    </svg>
  </div>
</template>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: #bfe7ff;
  cursor: pointer;
}
.play {
  width: min(40vw, 40vh);
  animation: pulse 1.6s ease-in-out infinite;
}
.play circle { fill: #ffd93d; stroke: #fff; stroke-width: 4; }
.play path { fill: #fff; stroke: #fff; stroke-width: 6; stroke-linejoin: round; }
@keyframes pulse { 50% { transform: scale(1.08); } }
</style>
