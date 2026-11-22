<script setup lang="ts">
// Placeholder until its task is built: leaves at once with nothing
import { onMounted } from 'vue'
import type { BuildingResult } from '../types'

const emit = defineEmits<{ finished: [result: BuildingResult] }>()
onMounted(() => emit('finished', { stars: 0 }))
</script>

<template>
  <div />
</template>
