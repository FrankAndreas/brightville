<script setup lang="ts">
import type { TimeOfDay } from '@/core/kalender'

// A little sky: in the morning the sun rises on the left with its rays and a bird flies; at noon it stands high; in
// the evening it sinks half under the ground on the right and the first star shows; at night the moon and the stars
defineProps<{ time: TimeOfDay }>()

const SKY: Record<TimeOfDay, string> = { morgen: '#ffeec2', mittag: '#9fd3ff', abend: '#f08a6c', nacht: '#24305e' }
const RAYS = [-60, -30, 0, 30, 60].map(a => (a * Math.PI) / 180)
</script>

<template>
  <svg class="sky" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="0" y="0" width="100" height="100" :fill="SKY[time]" />
    <template v-if="time === 'nacht'">
      <circle cx="56" cy="38" r="17" fill="#fff6c8" />
      <circle cx="64" cy="32" r="15" :fill="SKY.nacht" />
      <circle v-for="s in [[20, 22], [80, 20], [30, 50], [84, 56]]" :key="s.join()" :cx="s[0]" :cy="s[1]" r="2" fill="#fff6c8" />
    </template>
    <template v-else-if="time === 'morgen'">
      <g data-test="rays" stroke="#f9a825" stroke-width="3" stroke-linecap="round">
        <line v-for="(a, i) in RAYS" :key="i" :x1="24 + 17 * Math.sin(a)" :y1="62 - 17 * Math.cos(a)" :x2="24 + 25 * Math.sin(a)" :y2="62 - 25 * Math.cos(a)" />
      </g>
      <circle data-test="sun" cx="24" cy="62" r="12" fill="#ffca28" stroke="#f9a825" stroke-width="3" />
      <path data-test="bird" d="M62 30 q5 -6 10 0 q5 -6 10 0" fill="none" stroke="#3b3b58" stroke-width="2.5" stroke-linecap="round" />
    </template>
    <circle v-else-if="time === 'mittag'" data-test="sun" cx="50" cy="24" r="13" fill="#ffca28" stroke="#f9a825" stroke-width="3" />
    <template v-else>
      <circle data-test="star" cx="26" cy="22" r="2.5" fill="#fff6c8" />
      <circle data-test="sun" cx="76" cy="78" r="15" fill="#ff7043" stroke="#e64a19" stroke-width="3" />
    </template>
    <rect x="0" y="76" width="100" height="24" :fill="time === 'nacht' ? '#1d3b2a' : time === 'abend' ? '#4f7d4a' : '#7cc576'" />
  </svg>
</template>

<style scoped>
.sky { width: 100%; height: 100%; display: block; border-radius: 14px; }
</style>
