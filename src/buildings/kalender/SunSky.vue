<script setup lang="ts">
import type { TimeOfDay } from '@/core/kalender'

// A little sky: the sun low on the left in the morning, high at noon, setting on the right in the evening, the moon
// and stars at night
defineProps<{ time: TimeOfDay }>()

const SKY: Record<TimeOfDay, string> = { morgen: '#ffe3b3', mittag: '#9fd3ff', abend: '#ffb38a', nacht: '#24305e' }
const SUN: Record<Exclude<TimeOfDay, 'nacht'>, { x: number; y: number }> = {
  morgen: { x: 22, y: 64 }, mittag: { x: 50, y: 24 }, abend: { x: 78, y: 64 },
}
</script>

<template>
  <svg class="sky" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="0" y="0" width="100" height="100" rx="14" :fill="SKY[time]" />
    <template v-if="time === 'nacht'">
      <circle cx="56" cy="38" r="17" fill="#fff6c8" />
      <circle cx="64" cy="32" r="15" :fill="SKY.nacht" />
      <circle v-for="s in [[20, 22], [80, 20], [30, 50], [84, 56]]" :key="s.join()" :cx="s[0]" :cy="s[1]" r="2" fill="#fff6c8" />
    </template>
    <circle v-else :cx="SUN[time].x" :cy="SUN[time].y" r="13" fill="#ffca28" stroke="#f9a825" stroke-width="3" />
    <rect x="0" y="76" width="100" height="24" :fill="time === 'nacht' ? '#1d3b2a' : '#7cc576'" />
  </svg>
</template>

<style scoped>
.sky { width: 100%; height: 100%; display: block; border-radius: 14px; }
</style>
