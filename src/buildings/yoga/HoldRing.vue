<script setup lang="ts">
import { computed } from 'vue'

/** A ring that fills clockwise while the pose is held. */
const props = defineProps<{ progress: number }>()

const RADIUS = 46
const LENGTH = 2 * Math.PI * RADIUS
const offset = computed(() => LENGTH * (1 - Math.min(1, Math.max(0, props.progress))))
</script>

<template>
  <svg class="ring" viewBox="0 0 100 100" data-test="ring" :data-progress="progress.toFixed(3)" aria-hidden="true">
    <circle class="track" cx="50" cy="50" :r="RADIUS" />
    <circle class="fill" cx="50" cy="50" :r="RADIUS" :stroke-dasharray="LENGTH" :stroke-dashoffset="offset" />
  </svg>
</template>

<style scoped>
.ring { width: 100%; height: 100%; transform: rotate(-90deg); }
circle { fill: none; stroke-width: 6; }
.track { stroke: rgb(255 255 255 / 55%); }
.fill { stroke: #ffd93d; stroke-linecap: round; transition: stroke-dashoffset 0.1s linear; }
</style>
