<script setup lang="ts">
import { computed } from 'vue'
import type { Body, Joint } from '@/core/pose/body'

/** A cheerful figure showing a body: drawn from the same bodies the move rules are tested with. */
const props = defineProps<{ body: Body; color?: string }>()

const LIMBS: Joint[][] = [
  ['lWrist', 'lElbow', 'lShoulder', 'rShoulder', 'rElbow', 'rWrist'],
  ['lAnkle', 'lKnee', 'lHip', 'rHip', 'rKnee', 'rAnkle'],
]
const points = (joints: Joint[]) => joints.map(j => `${props.body[j].x * 100},${props.body[j].y * 100}`).join(' ')
const torso = computed(() => points(['lShoulder', 'rShoulder', 'rHip', 'lHip']))
</script>

<template>
  <svg class="figure" viewBox="0 0 100 100" aria-hidden="true" :style="{ '--skin': color ?? '#ff9a3c' }">
    <polyline v-for="(limb, i) in LIMBS" :key="i" class="limb" :points="points(limb)" />
    <polygon class="torso" :points="torso" />
    <g :transform="`translate(${body.nose.x * 100} ${body.nose.y * 100})`">
      <circle class="head" r="8.5" />
      <circle class="eye" cx="-3" cy="-1.5" r="1.1" />
      <circle class="eye" cx="3" cy="-1.5" r="1.1" />
      <path class="smile" d="M-3.5 2.5 Q0 6 3.5 2.5" />
    </g>
  </svg>
</template>

<style scoped>
.figure { width: 100%; height: 100%; overflow: visible; }
.limb { fill: none; stroke: color-mix(in srgb, var(--skin) 80%, black); stroke-width: 6.5; stroke-linecap: round; stroke-linejoin: round; }
.torso { fill: var(--skin); stroke: var(--skin); stroke-width: 7; stroke-linejoin: round; }
.head { fill: color-mix(in srgb, var(--skin) 60%, white); stroke: color-mix(in srgb, var(--skin) 80%, black); stroke-width: 1.5; }
.eye { fill: #222; }
.smile { fill: none; stroke: #222; stroke-width: 1.2; stroke-linecap: round; }
polyline, polygon, g { transition: all 0.3s ease; }
</style>
