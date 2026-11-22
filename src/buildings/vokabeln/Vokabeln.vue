<script setup lang="ts">
// The School at Oberstufe: the vocabulary trainer (filled in by the next step of the plan)
import type { BuildingResult } from '../types'

defineEmits<{ finished: [result: BuildingResult] }>()
</script>

<template>
  <div data-test="vokabeln" />
</template>
