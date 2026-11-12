<script setup lang="ts">
import { computed } from 'vue'
import type { Joint } from '@/core/pose/body'
import { FIXTURES, standing } from '@/core/pose/fixtures'
import type { PoseId } from '@/core/pose/poses'

/**
 * The teacher shows the pose. It is drawn from the same example bodies the
 * rules are tested with, so what it shows is always what the rules accept.
 */
const props = defineProps<{ pose: PoseId | null }>()

const body = computed(() => (props.pose ? FIXTURES[props.pose] : standing()))

const LIMBS: Joint[][] = [
  ['lWrist', 'lElbow', 'lShoulder', 'rShoulder', 'rElbow', 'rWrist'],
  ['lAnkle', 'lKnee', 'lHip', 'rHip', 'rKnee', 'rAnkle'],
]
const points = (joints: Joint[]) => joints.map(j => `${body.value[j].x * 100},${body.value[j].y * 100}`).join(' ')
const torso = computed(() => points(['lShoulder', 'rShoulder', 'rHip', 'lHip']))
</script>

<template>
  <svg class="teacher" viewBox="0 0 100 100" data-test="teacher" :data-pose="pose ?? 'none'" aria-hidden="true">
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
.teacher { width: 100%; height: 100%; overflow: visible; }
.limb { fill: none; stroke: #f07f1b; stroke-width: 6.5; stroke-linecap: round; stroke-linejoin: round; }
.torso { fill: #ff9a3c; stroke: #ff9a3c; stroke-width: 7; stroke-linejoin: round; }
.head { fill: #ffb866; stroke: #f07f1b; stroke-width: 1.5; }
.eye { fill: #222; }
.smile { fill: none; stroke: #222; stroke-width: 1.2; stroke-linecap: round; }
polyline, polygon, g { transition: all 0.4s ease; }
</style>
