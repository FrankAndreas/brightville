<script setup lang="ts">
import type { Piece } from '@/core/patterns'

// One drawn piece of a row: a filled shape in one of four clear colours, big or small
defineProps<{ piece: Piece }>()

const FILL = { rot: '#e53935', blau: '#1e88e5', gelb: '#fdd835', gruen: '#43a047' } as const
const EDGE = { rot: '#a32725', blau: '#135ea0', gelb: '#c5a600', gruen: '#2d7330' } as const
</script>

<template>
  <svg class="piece" viewBox="0 0 100 100" :data-big="piece.big" aria-hidden="true">
    <g :transform="piece.big ? undefined : 'translate(20 20) scale(0.6)'" :fill="FILL[piece.colour]" :stroke="EDGE[piece.colour]" stroke-width="5" stroke-linejoin="round">
      <circle v-if="piece.shape === 'kreis'" cx="50" cy="50" r="42" />
      <polygon v-else-if="piece.shape === 'dreieck'" points="50,8 93,88 7,88" />
      <rect v-else x="10" y="10" width="80" height="80" rx="6" />
    </g>
  </svg>
</template>

<style scoped>
.piece { width: 100%; height: 100%; display: block; }
</style>
