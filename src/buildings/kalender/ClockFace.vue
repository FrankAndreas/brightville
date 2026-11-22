<script setup lang="ts">
import { computed } from 'vue'
import type { ClockTime } from '@/core/kalender'

// A round clock with twelve dots and the numbers 12, 3, 6, 9: a short thick hour hand and a long thin minute hand.
// On a half hour the hour hand stands halfway to the next hour. `minute` (the Oberstufe's Kalender, five-minute
// steps): the hands for that minute; left out, full and half hours as in the Kindergarten Kalender.
const props = defineProps<{ clock: ClockTime; minute?: number }>()

const minutes = computed(() => props.minute ?? (props.clock.half ? 30 : 0))
const hourAngle = computed(() => ((props.clock.hour % 12) + minutes.value / 60) * 30)
const minuteAngle = computed(() => minutes.value * 6)
const dots = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180
  return { x: 50 + 40 * Math.sin(a), y: 50 - 40 * Math.cos(a), big: i % 3 === 0 }
})
const NUMBERS = [{ n: 12, x: 50, y: 22 }, { n: 3, x: 80, y: 54 }, { n: 6, x: 50, y: 86 }, { n: 9, x: 20, y: 54 }]
</script>

<template>
  <svg class="clock" viewBox="0 0 100 100" data-test="clock-face" :data-time="`${clock.hour}:${String(minutes).padStart(2, '0')}`" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="#fffdf5" stroke="#3b3b58" stroke-width="4" />
    <circle v-for="(d, i) in dots" :key="i" :cx="d.x" :cy="d.y" :r="d.big ? 2.6 : 1.6" fill="#3b3b58" />
    <line x1="50" y1="50" x2="50" y2="14" stroke="#1e88e5" stroke-width="3" stroke-linecap="round" :transform="`rotate(${minuteAngle} 50 50)`" />
    <line x1="50" y1="50" x2="50" y2="28" stroke="#e53935" stroke-width="6" stroke-linecap="round" :transform="`rotate(${hourAngle} 50 50)`" />
    <circle cx="50" cy="50" r="4" fill="#3b3b58" />
    <!-- The numbers over the hands, ringed in the face's colour: a hand on the 12 never hides it -->
    <text
      v-for="t in NUMBERS" :key="t.n" :x="t.x" :y="t.y" text-anchor="middle" font-size="11" font-weight="700" fill="#6b6b88"
      stroke="#fffdf5" stroke-width="3" paint-order="stroke"
    >{{ t.n }}</text>
  </svg>
</template>

<style scoped>
.clock { width: 100%; height: 100%; display: block; }
</style>
